export type OrderStatus = 'pending' | 'preparing' | 'delivered' | 'cancelled';

export interface AcademicOrder {
  id: string;
  customerName: string;
  totalProducts: number;
  status: OrderStatus;
  createdAt: string;
}
