require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const Stripe = require('stripe');
const multer = require('multer');
const { User, Service, Booking, Payment } = require('./models');
const { verifyToken, verifyCustomer, verifyTechnician, verifyAdmin } = require('./middleware');

const app = express();
app.use(cors({ origin: (process.env.CLIENT_URL || 'http://localhost:5173').split(','), credentials: true }));
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

const signToken = (user) => jwt.sign({ id: user._id, email: user.email, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, image: u.image, role: u.role, phone: u.phone, area: u.area, bio: u.bio });

async function seed() {
  if (await User.countDocuments()) return;
  const hash = (s) => bcrypt.hashSync(s, 10);
  const tech1 = await User.create({ name: 'Arif Rahman', email: 'tech@fixmate.test', password: hash('Tech123'), role: 'technician', phone: '01700000001', area: 'Dhanmondi, Dhaka', bio: 'Certified technician with 8 years of repair experience.', image: 'https://i.pravatar.cc/300?img=12' });
  const tech2 = await User.create({ name: 'Nadia Islam', email: 'nadia@fixmate.test', password: hash('Tech123'), role: 'technician', phone: '01700000002', area: 'Mirpur, Dhaka', bio: 'Home appliance and electrical specialist.', image: 'https://i.pravatar.cc/300?img=47' });
  await User.create({ name: 'FixMate Admin', email: 'admin@fixmate.test', password: hash('Admin123'), role: 'admin', image: 'https://i.pravatar.cc/300?img=11' });
  const customer = await User.create({ name: 'Tahsin Ahmed', email: 'customer@fixmate.test', password: hash('Customer123'), role: 'customer', phone: '01800000000', area: 'Uttara, Dhaka', image: 'https://i.pravatar.cc/300?img=33' });
  const serviceData = [
    ['iPhone Screen Replacement', 'Smartphone', 129, 'Home Visit'],
    ['Android Phone Repair', 'Smartphone', 89, 'Shop Drop-off'],
    ['Laptop Diagnostic & Cleaning', 'Laptop & PC', 79, 'Shop Drop-off'],
    ['Windows PC Upgrade', 'Laptop & PC', 149, 'Home Visit'],
    ['Split AC Deep Servicing', 'AC', 119, 'Home Visit'],
    ['AC Gas Refill', 'AC', 180, 'Home Visit'],
    ['Refrigerator Repair', 'Refrigerator', 95, 'Home Visit'],
    ['Deep Freezer Maintenance', 'Refrigerator', 110, 'Home Visit'],
    ['Smart TV Panel Check', 'TV', 85, 'Shop Drop-off'],
    ['LED TV Wall Mounting', 'TV', 65, 'Home Visit'],
    ['Washing Machine Repair', 'Washing Machine', 75, 'Home Visit'],
    ['Automatic Washer Servicing', 'Washing Machine', 99, 'Home Visit'],
    ['Home Electrical Wiring', 'Electrical', 55, 'Home Visit'],
  ];
  const images = [
    'https://images.unsplash.com/photo-1592890288564-76628a30a7a4?w=900',
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=900',
    'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73d?w=900',
  ];
  const services = [];
  for (let i = 0; i < serviceData.length; i++) {
    const [title, category, basePrice, serviceMode] = serviceData[i];
    const tech = i % 2 ? tech1 : tech2;
    services.push(await Service.create({
      title, category, basePrice, serviceMode,
      description: `Professional ${title.toLowerCase()} by a verified FixMate specialist. Includes diagnosis and a clear work report.`,
      image: images[i % images.length],
      estimatedDuration: i % 3 === 0 ? '2-3 hours' : '1 day',
      serviceArea: tech.area,
      technicianName: tech.name,
      technicianEmail: tech.email,
      approvalStatus: 'approved',
      isAvailable: true,
    }));
  }
  await Booking.create({
    serviceId: services[0]._id.toString(), serviceTitle: services[0].title, serviceImage: services[0].image,
    category: services[0].category, basePrice: services[0].basePrice, technicianName: tech2.name,
    technicianEmail: tech2.email, customerName: customer.name, customerEmail: customer.email,
    customerPhone: customer.phone, address: 'Uttara Sector 10, Dhaka', preferredDate: new Date(Date.now() + 86400000),
    problemDescription: 'The phone screen has visible cracks and touch response is inconsistent.',
    status: 'requested', finalAmount: services[0].basePrice, paymentStatus: 'unpaid',
  });
  await Booking.create({
    serviceId: services[4]._id.toString(), serviceTitle: services[4].title, serviceImage: services[4].image,
    category: services[4].category, basePrice: services[4].basePrice, technicianName: tech1.name,
    technicianEmail: tech1.email, customerName: customer.name, customerEmail: customer.email,
    customerPhone: customer.phone, address: 'Dhanmondi 27, Dhaka', preferredDate: new Date(),
    problemDescription: 'The air conditioner is cooling slowly and needs a complete deep servicing.',
    status: 'completed', finalAmount: 135, paymentStatus: 'unpaid',
  });
  console.log('Seed data created');
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role = 'customer' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All required fields must be provided' });
    if (password.length < 6 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) return res.status(400).json({ message: 'Password must meet requirements' });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: 'Email already exists' });
    const safeRole = ['customer', 'technician'].includes(role) ? role : 'customer';
    const user = await User.create({ name, email: email.toLowerCase(), password: await bcrypt.hash(password, 10), role: safeRole });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) { res.status(400).json({ message: error.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(password || '', user.password))) return res.status(401).json({ message: 'Invalid email or password' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/auth/me', verifyToken, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json(publicUser(user));
});

app.patch('/api/users/profile', verifyToken, async (req, res) => {
  const allowed = ['name', 'phone', 'area', 'bio', 'image'];
  const update = {};
  allowed.forEach((key) => { if (req.body[key] !== undefined) update[key] = req.body[key]; });
  const user = await User.findByIdAndUpdate(req.user.id, update, { new: true, runValidators: true });
  res.json(publicUser(user));
});

app.post('/api/upload/image', verifyToken, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Image required' });
  if (!process.env.IMGBB_API_KEY) return res.status(503).json({ message: 'ImgBB is not configured' });
  const form = new URLSearchParams();
  form.append('image', req.file.buffer.toString('base64'));
  const response = await axios.post(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, form);
  res.json({ url: response.data.data.url });
});

app.get('/api/services', async (req, res) => {
  const { search = '', category = '', mode = '', sort = 'newest', page = 1, limit = 12 } = req.query;
  const filter = { approvalStatus: 'approved', isAvailable: true };
  if (search) filter.$or = [{ title: { $regex: search, $options: 'i' } }, { category: { $regex: search, $options: 'i' } }];
  if (category) filter.category = category;
  if (mode) filter.serviceMode = mode;
  const sortMap = { low: { basePrice: 1 }, high: { basePrice: -1 }, newest: { createdAt: -1 } };
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const [items, total] = await Promise.all([
    Service.find(filter).sort(sortMap[sort] || sortMap.newest).skip((pageNumber - 1) * pageSize).limit(pageSize),
    Service.countDocuments(filter),
  ]);
  res.json({ items, total, page: pageNumber, pages: Math.ceil(total / pageSize) });
});

app.get('/api/services/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Not found' });
  const service = await Service.findOne({ _id: req.params.id, approvalStatus: 'approved', isAvailable: true });
  if (!service) return res.status(404).json({ message: 'Not found' });
  const technician = await User.findOne({ email: service.technicianEmail });
  res.json({ ...service.toObject(), technician });
});

app.post('/api/services', verifyToken, verifyTechnician, async (req, res) => {
  const count = await Service.countDocuments({ technicianEmail: req.user.email });
  if (req.body.basePrice === undefined) return res.status(400).json({ message: 'Invalid service' });
  const data = { ...req.body, technicianName: req.user.name, technicianEmail: req.user.email, approvalStatus: 'pending', isAvailable: true };
  const service = await Service.create(data);
  res.status(201).json(service);
});

app.patch('/api/services/:id', verifyToken, verifyTechnician, async (req, res) => {
  const service = await Service.findOne({ _id: req.params.id, technicianEmail: req.user.email });
  if (!service) return res.status(404).json({ message: 'Service not found' });
  const allowed = ['title', 'category', 'description', 'image', 'basePrice', 'estimatedDuration', 'serviceMode', 'serviceArea', 'isAvailable'];
  allowed.forEach((key) => { if (req.body[key] !== undefined) service[key] = req.body[key]; });
  if (req.body.isAvailable === undefined) service.approvalStatus = 'pending';
  await service.save();
  res.json(service);
});

app.delete('/api/services/:id', verifyToken, verifyTechnician, async (req, res) => {
  const result = await Service.findOneAndDelete({ _id: req.params.id, technicianEmail: req.user.email });
  if (!result) return res.status(404).json({ message: 'Service not found' });
  res.json({ message: 'Deleted' });
});

app.get('/api/services/technician/mine', verifyToken, verifyTechnician, async (req, res) =>
  res.json(await Service.find({ technicianEmail: req.user.email }).sort({ createdAt: -1 })));

app.post('/api/bookings', verifyToken, verifyCustomer, async (req, res) => {
  const service = await Service.findOne({ _id: req.body.serviceId, approvalStatus: 'approved', isAvailable: true });
  if (!service) return res.status(404).json({ message: 'Service not found' });
  if (service.technicianEmail === req.user.email) return res.status(403).json({ message: 'You cannot request your own service' });
  if (!req.body.address || !req.body.problemDescription || req.body.problemDescription.length < 20) return res.status(400).json({ message: 'Complete the repair request details' });
  const preferredDate = new Date(req.body.preferredDate);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (Number.isNaNaN(preferredDate.getTime()) || preferredDate < today) return res.status(400).json({ message: 'Preferred date must be today or later' });
  const active = await Booking.findOne({ serviceId: service._id.toString(), customerEmail: req.user.email, status: { $in: ['requested', 'accepted', 'in-progress'] } });
  if (active) return res.status(409).json({ message: 'You already have an active request for this service' });
  const booking = await Booking.create({
    serviceId: service._id.toString(), serviceTitle: service.title, serviceImage: service.image, category: service.category,
    basePrice: service.basePrice, technicianName: service.technicianName, technicianEmail: service.technicianEmail,
    customerName: req.user.name, customerEmail: req.user.email, customerPhone: req.body.phone, address: req.body.address,
    preferredDate, problemDescription: req.body.problemDescription, status: 'requested', finalAmount: service.basePrice,
    paymentStatus: 'unpaid', statusHistory: [{ status: 'requested' }],
  });
  res.status(201).json(booking);
});

app.get('/api/bookings/my', verifyToken, verifyCustomer, async (req, res) =>
  res.json(await Booking.find({ customerEmail: req.user.email }).sort({ createdAt: -1 })));

app.patch('/api/bookings/:id/cancel', verifyToken, verifyCustomer, async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, customerEmail: req.user.email });
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (booking.status !== 'requested') return res.status(400).json({ message: 'Only requested jobs can be cancelled' });
  booking.status = 'cancelled'; booking.statusHistory.push({ status: 'cancelled' }); await booking.save();
  res.json(booking);
});

app.get('/api/bookings/technician', verifyToken, verifyTechnician, async (req, res) =>
  res.json(await Booking.find({ technicianEmail: req.user.email }).sort({ createdAt: -1 })));

app.patch('/api/bookings/:id/status', verifyToken, verifyTechnician, async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, technicianEmail: req.user.email });
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  const next = req.body.status;
  const allowed = { requested: ['accepted', 'rejected'], accepted: ['in-progress'], 'in-progress': ['completed'] };
  if (!allowed[booking.status]?.includes(next)) return res.status(400).json({ message: 'Invalid status transition' });
  if (next === 'completed') {
    if (!Number(req.body.finalAmount) || Number(req.body.finalAmount) <= 0) return res.status(400).json({ message: 'Final amount must be greater than 0' });
    booking.finalAmount = Number(req.body.finalAmount);
  }
  booking.status = next; booking.statusHistory.push({ status: next }); await booking.save();
  res.json(booking);
});

app.post('/api/payments/create-checkout-session', verifyToken, verifyCustomer, async (req, res) => {
  if (!stripe) return res.status(503).json({ message: 'Stripe is not configured' });
  const booking = await Booking.findOne({ _id: req.body.bookingId, customerEmail: req.user.email });
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (booking.status !== 'completed' || booking.paymentStatus !== 'unpaid') return res.status(400).json({ message: 'Payment is not available for this booking' });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price_data: { currency: 'usd', product_data: { name: booking.serviceTitle }, unit_amount: Math.round(booking.finalAmount * 100) }, quantity: 1 }],
    success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
    metadata: { bookingId: booking._id.toString(), customerEmail: booking.customerEmail },
  });
  res.json({ url: session.url });
});

async function savePayment(session) {
  const booking = await Booking.findById(session.metadata.bookingId);
  if (!booking || booking.status !== 'completed') return null;
  const existing = await Payment.findOne({ bookingId: booking._id.toString() });
  if (existing) return existing;
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  const payment = await Payment.create({
    bookingId: booking._id.toString(), serviceTitle: booking.serviceTitle, customerName: booking.customerName,
    customerEmail: booking.customerEmail, technicianName: booking.technicianName, technicianEmail: booking.technicianEmail,
    amount: booking.finalAmount, currency: 'usd', transactionId: paymentIntent || `manual-${session.id}`,
    stripeSessionId: session.id, paymentStatus: 'paid',
  });
  booking.paymentStatus = 'paid'; booking.statusHistory.push({ status: 'paid' }); await booking.save();
  return payment;
}

app.get('/api/payments/verify', verifyToken, verifyCustomer, async (req, res) => {
  if (!stripe) return res.status(503).json({ message: 'Stripe is not configured' });
  const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
  if (session.payment_status !== 'paid' || session.metadata.customerEmail !== req.user.email) return res.status(400).json({ message: 'Payment is not paid or does not belong to you' });
  const payment = await savePayment(session);
  res.json(payment);
});

app.get('/api/payments/my', verifyToken, verifyCustomer, async (req, res) =>
  res.json(await Payment.find({ customerEmail: req.user.email }).sort({ paidAt: -1 })));

app.post('/api/payments/webhook', async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).json({ message: 'Webhook not configured' });
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch (error) { return res.status(400).send(`Webhook Error: ${error.message}`); }
  if (event.type === 'checkout.session.completed') await savePayment(event.data.object);
  res.json({ received: true });
});

app.get('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => res.json(await User.find().sort({ createdAt: -1 })));
app.patch('/api/admin/users/:id/role', verifyToken, verifyAdmin, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot change your own role' });
  if (!['customer', 'technician', 'admin'].includes(req.body.role)) return res.status(400).json({ message: 'Invalid role' });
  const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true });
  res.json(publicUser(user));
});
app.get('/api/admin/services', verifyToken, verifyAdmin, async (req, res) => res.json(await Service.find().sort({ approvalStatus: 1, createdAt: -1 })));
app.patch('/api/admin/services/:id/approval', verifyToken, verifyAdmin, async (req, res) => {
  if (!['approved', 'rejected'].includes(req.body.approvalStatus)) return res.status(400).json({ message: 'Invalid approval status' });
  const service = await Service.findByIdAndUpdate(req.params.id, { approvalStatus: req.body.approvalStatus }, { new: true });
  res.json(service);
});
app.get('/api/admin/bookings', verifyToken, verifyAdmin, async (req, res) => res.json(await Booking.find().sort({ createdAt: -1 })));
app.get('/api/admin/payments', verifyToken, verifyAdmin, async (req, res) => res.json(await Payment.find().sort({ paidAt: -1 })));
app.get('/api/admin/stats', verifyToken, verifyAdmin, async (req, res) => res.json({
  users: await User.countDocuments(), technicians: await User.countDocuments({ role: 'technician' }),
  pendingServices: await Service.countDocuments({ approvalStatus: 'pending' }),
  bookings: await Booking.countDocuments(),
}));

app.get('/api/technician/stats', verifyToken, verifyTechnician, async (req, res) => res.json({
  totalServices: await Service.countDocuments({ technicianEmail: req.user.email }),
  approvedServices: await Service.countDocuments({ technicianEmail: req.user.email, approvalStatus: 'approved' }),
  pendingRequests: await Booking.countDocuments({ technicianEmail: req.user.email, status: 'requested' }),
}));
app.get('/api/customer/stats', verifyToken, verifyCustomer, async (req, res) => {
  const filter = { customerEmail: req.user.email };
  res.json({
    total: await Booking.countDocuments(filter),
    active: await Booking.countDocuments({ ...filter, status: { $in: ['requested', 'accepted', 'in-progress'] } }),
    completed: await Booking.countDocuments({ ...filter, status: 'completed' }),
  });
});

app.use((req, res) => res.status(404).json({ message: 'API route not found' }));

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await seed();
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`FixMate server running on port ${port}`));
}).catch((error) => {
  console.error('MongoDB connection failed:', error.message);
  process.exit(1);
});
