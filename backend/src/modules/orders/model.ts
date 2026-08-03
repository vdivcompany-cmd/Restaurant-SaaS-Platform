import { Schema, model, type Document, type Types } from 'mongoose';

export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'PAID' | 'CANCELLED';
export type OrderChannel = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'QR' | 'WEB' | 'TELEGRAM';

export interface IOrderItemVariant {
  variantId?: Types.ObjectId;
  variantName?: string;
  selectedOptionNames?: string[];
  priceDelta?: number;
}

export interface IOrderItem {
  productId: Types.ObjectId;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedVariants?: IOrderItemVariant[];
  notes?: string;
}

export interface IOrder extends Document {
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  orderNumber: string;
  channel: OrderChannel;
  status: OrderStatus;
  tableId?: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  offlineGuid?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    orderNumber: { type: String, required: true },
    channel: {
      type: String,
      enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'QR', 'WEB', 'TELEGRAM'],
      default: 'DINE_IN',
    },
    status: {
      type: String,
      enum: ['PENDING', 'PREPARING', 'READY', 'SERVED', 'PAID', 'CANCELLED'],
      default: 'PENDING',
    },
    tableId: { type: Schema.Types.ObjectId, ref: 'Table' },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
        selectedVariants: [
          {
            variantId: { type: Schema.Types.ObjectId },
            variantName: { type: String },
            selectedOptionNames: [{ type: String }],
            priceDelta: { type: Number, default: 0 },
          },
        ],
        notes: { type: String },
      },
    ],
    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    offlineGuid: { type: String, index: true, sparse: true },
  },
  { timestamps: true },
);

OrderSchema.index({ tenantId: 1, branchId: 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, branchId: 1, status: 1 });

export const OrderModel = model<IOrder>('Order', OrderSchema);
