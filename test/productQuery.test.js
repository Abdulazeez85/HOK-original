const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProductQuery } = require('../productQuery');

test('builds a MongoDB query from product filters', () => {
  const query = buildProductQuery({
    category: 'laptop',
    brand: 'HP',
    condition: 'New',
    ram: '16GB',
    storage: '512GB',
    maxPrice: '500000',
    search: 'elitebook'
  });

  assert.deepEqual(query, {
    category: 'laptop',
    brand: 'HP',
    'specs.condition': 'New',
    'specs.ram': '16GB',
    'specs.storage': '512GB',
    price: { $lte: 500000 },
    $or: [
      { name: /elitebook/i },
      { brand: /elitebook/i },
      { 'specs.cpu': /elitebook/i },
      { 'specs.ram': /elitebook/i },
      { 'specs.storage': /elitebook/i },
      { 'specs.display': /elitebook/i },
      { 'specs.condition': /elitebook/i }
    ]
  });
});

test('ignores empty filters and rejects invalid prices', () => {
  assert.deepEqual(buildProductQuery({ maxPrice: 'invalid' }), {});
  assert.deepEqual(buildProductQuery({ search: '   ' }), {});
});
