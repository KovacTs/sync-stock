import { requestSOABus } from './lib/soabus';

async function testAddStock() {
  console.log('Testing adding stock to PES-CA1 (Caña de Pescar Shakespeare Ugly Stik) in Tienda Valdivia...');
  try {
    const payload = JSON.stringify({
      action: 'add-stock',
      sku: 'PES-CA1',
      cantidad: 5,
      ubicacion: 'Tienda Valdivia'
    });
    const { status, data } = await requestSOABus('sales', payload);
    console.log('Response Status:', status);
    console.log('Response Data:', data);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAddStock();
