import { Schema, model, type Document, type Types } from 'mongoose';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'PAID'
  | 'COMPLETED'
  | 'CANCELLED';

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

export interface ICustomerEmbedded {
  name: string;
  phone?: string;
  email?: string;
  deliveryAddress?: string;
  notes?: string;
}

export interface ICashierConfirmation {
  confirmedBy?: Types.ObjectId;
  confirmedAt?: Date;
  notes?: string;
}

export interface IKitchenExecution {
  receivedAt?: Date;
  startedAt?: Date;
  completedBy?: Types.ObjectId;
  completedAt?: Date;
  kitchenNotes?: string;
}

export interface IOrder extends Document {
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  orderNumber: string;
  channel: OrderChannel;
  status: OrderStatus;
  tableId?: Types.ObjectId;
  tableNumber?: number | string;
  
  // Embedded Customer (replaces standalone reference)
  customer?: ICustomerEmbedded;
  
  // Legacy / Direct access fields for backward-compatibility
  customerId?: Types.ObjectId;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;

  // Items & Pricing
  items: IOrderItem[];
  subtotal: number;
  couponCode?: string;
  couponId?: Types.ObjectId;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;

  // Two-Stage Cashier & Kitchen Workflow
  cashierConfirmation?: ICashierConfirmation;
  kitchenExecution?: IKitchenExecution;

  offlineGuid?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerEmbeddedSchema = new Schema<ICustomerEmbedded>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    deliveryAddress: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const cashierConfirmationSchema = new Schema<ICashierConfirmation>(
  {
    confirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    confirmedAt: { type: Date },
    notes: { type: String },
  },
  { _id: false }
);

const kitchenExecutionSchema = new Schema<IKitchenExecution>(
  {
    receivedAt: { type: Date },
    startedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
    kitchenNotes: { type: String },
  },
  { _id: false }
);

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
      enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'PAID', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
    },
    tableId: { type: Schema.Types.ObjectId, ref: 'Table' },
    tableNumber: { type: Schema.Types.Mixed },
    
    // Embedded Customer Subdocument
    customer: { type: customerEmbeddedSchema },

    // Legacy fields maintained for backward-compatibility
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String },
    customerPhone: { type: String },
    deliveryAddress: { type: String },

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
    couponCode: { type: String, uppercase: true, trim: true },
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    // Cashier & Kitchen Subdocuments
    cashierConfirmation: { type: cashierConfirmationSchema },
    kitchenExecution: { type: kitchenExecutionSchema },

    offlineGuid: { type: String, index: true, sparse: true },
  },
  { timestamps: true },
);

OrderSchema.index({ tenantId: 1, branchId: 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, branchId: 1, status: 1 });

export const OrderModel = model<IOrder>('Order', OrderSchema);

