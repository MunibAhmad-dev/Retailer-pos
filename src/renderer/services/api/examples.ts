import { request } from './apiClient';

// GET example: load a list resource.
export async function exampleGetProducts() {
  return request<any[]>({ method: 'GET', url: '/products' });
}

// POST example: create a new resource.
export async function exampleCreateProduct() {
  return request<any>({ method: 'POST', url: '/products', data: { name: 'Demo', price: 100 } });
}

// PUT example: update an existing resource.
export async function exampleUpdateProduct(id: number) {
  return request<any>({ method: 'PUT', url: `/products/${id}`, data: { price: 150 } });
}

// DELETE example: remove an existing resource.
export async function exampleDeleteProduct(id: number) {
  return request<any>({ method: 'DELETE', url: `/products/${id}` });
}
