const { apiHelper } = require('../utils/api-helper');
const { dbHelper } = require('../utils/db-helper');

describe('Stock Status Update', () => {
  let testProductId;
  let testInventoryId;

  beforeAll(async () => {
    // Создаем тестовый товар
    const productData = {
      name: 'Test Product for Stock Status',
      description: 'Test product for stock status update',
      stock_quantity: 10,
      stock_status: 'in_stock',
      in_stock: true
    };

    const createResponse = await apiHelper.post('/api/products', productData);
    expect(createResponse.success).toBe(true);
    testProductId = createResponse.data.id;

    // Создаем запись в инвентаре
    const inventoryData = {
      product_id: testProductId,
      sku: 'TEST-STOCK-001',
      name: 'Test Inventory Item',
      section_id: 1,
      quantity: 10
    };

    const inventoryResponse = await apiHelper.post('/api/warehouse/inventory', inventoryData);
    expect(inventoryResponse.success).toBe(true);
    testInventoryId = inventoryResponse.data.id;
  });

  afterAll(async () => {
    // Очищаем тестовые данные
    if (testProductId) {
      await apiHelper.delete(`/api/products/${testProductId}`);
    }
    if (testInventoryId) {
      await dbHelper.query('DELETE FROM warehouse_inventory WHERE id = $1', [testInventoryId]);
    }
  });

  test('should update product stock status when inventory quantity changes', async () => {
    // Проверяем начальное состояние
    const initialResponse = await apiHelper.get(`/api/products/${testProductId}`);
    expect(initialResponse.success).toBe(true);
    expect(initialResponse.data.stock_quantity).toBe(10);
    expect(initialResponse.data.stock_status).toBe('in_stock');
    expect(initialResponse.data.in_stock).toBe(true);

    // Изменяем количество в инвентаре на 0
    const updateData = {
      id: testInventoryId,
      quantity: 0
    };

    const updateResponse = await apiHelper.put('/api/warehouse/inventory', updateData);
    expect(updateResponse.success).toBe(true);

    // Ждем немного для обработки
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Проверяем что состояние товара обновилось
    const updatedResponse = await apiHelper.get(`/api/products/${testProductId}`);
    expect(updatedResponse.success).toBe(true);
    expect(updatedResponse.data.stock_quantity).toBe(0);
    expect(updatedResponse.data.stock_status).toBe('out_of_stock');
    expect(updatedResponse.data.in_stock).toBe(false);
  });

  test('should sync warehouse data correctly', async () => {
    // Восстанавливаем количество в инвентаре
    const restoreData = {
      id: testInventoryId,
      quantity: 5
    };

    await apiHelper.put('/api/warehouse/inventory', restoreData);

    // Запускаем синхронизацию
    const syncResponse = await apiHelper.post('/api/warehouse/sync', {});
    expect(syncResponse.success).toBe(true);

    // Проверяем что данные синхронизировались
    const syncedResponse = await apiHelper.get(`/api/products/${testProductId}`);
    expect(syncedResponse.success).toBe(true);
    expect(syncedResponse.data.stock_quantity).toBe(5);
    expect(syncedResponse.data.stock_status).toBe('in_stock');
    expect(syncedResponse.data.in_stock).toBe(true);
  });

  test('should clear cache after product update', async () => {
    // Обновляем товар напрямую
    const updateProductData = {
      name: 'Updated Test Product',
      stock_quantity: 15,
      stock_status: 'in_stock',
      in_stock: true
    };

    const updateResponse = await apiHelper.put(`/api/products/${testProductId}`, updateProductData);
    expect(updateResponse.success).toBe(true);

    // Проверяем что кэш очистился и данные обновились
    const freshResponse = await apiHelper.get(`/api/products/${testProductId}`);
    expect(freshResponse.success).toBe(true);
    expect(freshResponse.data.name).toBe('Updated Test Product');
    expect(freshResponse.data.stock_quantity).toBe(15);
  });

  test('should handle cache clearing API', async () => {
    const clearCacheResponse = await apiHelper.post('/api/cache/clear', {
      patterns: ['products:*']
    });

    expect(clearCacheResponse.success).toBe(true);
    expect(clearCacheResponse.message).toBe('Cache cleared successfully');
  });
});

module.exports = {
  name: 'Stock Status Update Test',
  description: 'Tests for stock status update functionality'
};