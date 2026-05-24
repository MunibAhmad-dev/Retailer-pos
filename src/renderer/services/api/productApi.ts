import { request } from './apiClient';
import { enqueueFailedSync } from './syncQueue';

export interface CloudProduct {
  id?: number | string;
  name: string;
  price: number;
  purchase_price?: number;
  stock?: number;
  category?: string;
  barcode?: string;
}

// Fetches products from cloud when internet is available.
export async function fetchProducts() {
  return request<CloudProduct[]>({ method: 'GET', url: '/products' });
}

// Creates a cloud product; failed uploads are queued for later sync.
export async function createProduct(product: CloudProduct) {
  try {
    return await request<CloudProduct>({ method: 'POST', url: '/products', data: product });
  } catch (error: any) {
    await enqueueFailedSync('product', 'create', product, error?.message);
    throw error;
  }
}

// Updates a cloud product; failed uploads are queued for later sync.
export async function updateProduct(id: number | string, product: Partial<CloudProduct>) {
  try {
    return await request<CloudProduct>({ method: 'PUT', url: `/products/${id}`, data: product });
  } catch (error: any) {
    await enqueueFailedSync('product', 'update', { id, ...product }, error?.message);
    throw error;
  }
}

// Deletes a cloud product; failed uploads are queued for later sync.
export async function deleteProduct(id: number | string) {
  try {
    return await request<{ success: boolean }>({ method: 'DELETE', url: `/products/${id}` });
  } catch (error: any) {
    await enqueueFailedSync('product', 'delete', { id }, error?.message);
    throw error;
  }
}

// Uploads local product changes in bulk. SQLite remains the source of truth.
export async function syncProducts(products: CloudProduct[]) {
  try {
    return await request<any>({ method: 'POST', url: '/products/sync', data: { products } });
  } catch (error: any) {
    await enqueueFailedSync('product', 'sync', { products }, error?.message);
    throw error;
  }
}
