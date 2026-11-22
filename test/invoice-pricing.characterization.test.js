var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

function discountedStaplesOrder() {
  return {
    coupon: 'SAVE10',
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
    ]
  };
}

test('invoice figures match the totals billed by pricing for an HSN and coupon order', function () {
  var order = discountedStaplesOrder();
  var billed = pricing.computeTotals(order.items, order.coupon);
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total
  });
});

test('pricing applies HSN GST after the coupon discount', function () {
  var order = discountedStaplesOrder();
  var totals = pricing.computeTotals(order.items, order.coupon);

  assert.deepEqual(totals, {
    subtotal: 1020,
    discount: 102,
    taxable: 918,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 640, discount: 64, taxable: 576, tax: 28.8, net: 604.8 },
      { id: 4, name: 'Sunflower oil', hsn: '1512', gstPercent: 5, gross: 380, discount: 38, taxable: 342, tax: 17.1, net: 359.1 }
    ]
  });
});

test('invoice figures use the billed HSN GST and coupon calculation', function () {
  var order = discountedStaplesOrder();
  var billed = pricing.computeTotals(order.items, order.coupon);
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures, {
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9,
    rows: [
      { name: 'Rice', sku: '-', hsn: '1006', qty: 1, price: 640, gstPercent: 5, line: 640, lineTax: 28.8 },
      { name: 'Sunflower oil', sku: '-', hsn: '1512', qty: 2, price: 190, gstPercent: 5, line: 380, lineTax: 17.1 }
    ]
  });
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.total, billed.total);
});

test('invoice calculation applies the SAVE10 maximum discount cap', function () {
  var order = {
    coupon: 'SAVE10',
    items: [{ id: 5, name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }]
  };
  var billed = pricing.computeTotals(order.items, order.coupon);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 104.5);
  assert.equal(billed.total, 2194.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
});

test('rendered invoice does not warn when its computed total matches the billed total', function () {
  var order = discountedStaplesOrder();
  var billed = pricing.computeTotals(order.items, order.coupon);
  order.id = 42;
  order.date = '01/01/2022';
  order.customer = 'Test customer';
  order.paymentMode = 'cash';
  order.status = 'completed';
  order.total = billed.total;

  var html = invoice.render(order);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});
