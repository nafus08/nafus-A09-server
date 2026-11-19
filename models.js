const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  image: { type: String, default: '' },
  role: { type: String, enum: ['customer', 'technician', 'admin'], default: 'customer' },
  phone: { type: String, default: '' },
  area: { type: String, default: '' },
  bio: { type: String, default: '' },
}, { timestamps: true });

const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  basePrice: { type: Number, required: true, min: 0 },
  estimatedDuration: { type: String, required: true },
  serviceMode: { type: String, enum: ['Home Visit', 'Shop Drop-off'], required: true },
  serviceArea: { type: String, required: true },
  technicianName: { type: String, required: true },
  technicianEmail: { type: String, required: true },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

const bookingSchema = new mongoose.Schema({
  serviceId: { type: String, required: true },
  serviceTitle: String,
  serviceImage: String,
  category: String,
  basePrice: Number,
  technicianName: String,
  technicianEmail: String,
  customerName: String,
  customerEmail: { type: String, required: true },
  customerPhone: String,
  address: String,
  preferredDate: Date,
  problemDescription: String,
  status: { type: String, enum: ['requested', 'accepted', 'rejected', 'in-progress', 'completed', 'cancelled'], default: 'requested' },
  finalAmount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
  statusHistory: [{ status: String, changedAt: { type: Date, default: Date.now } }],
  rating: { type: Number, min: 1, max: 5 },
  review: String,
}, { timestamps: true });

const paymentSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  serviceTitle: String,
  customerName: String,
  customerEmail: String,
  technicianName: String,
  technicianEmail: String,
  amount: Number,
  currency: { type: String, default: 'usd' },
  transactionId: { type: String, required: true },
  stripeSessionId: { type: String, required: true, unique: true },
  paymentStatus: { type: String, default: 'paid' },
  paidAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = {
  User: mongoose.model('User', userSchema),
  Service: mongoose.model('Service', serviceSchema),
  Booking: mongoose.model('Booking', bookingSchema),
  Payment: mongoose.model('Payment', paymentSchema),
};
