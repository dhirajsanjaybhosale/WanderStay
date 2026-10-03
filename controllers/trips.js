const Trip = require('../models/Trip');
const Expense = require('../models/Expense');
const Vote = require('../models/Vote');
const User = require('../models/user');

// List trips for current user
module.exports.index = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id : null;
    const trips = userId ? await Trip.find({ $or: [{ owner: userId }, { members: userId }] }).populate('owner') : [];
    res.render('trips/index', { trips });
  } catch (err) {
    next(err);
  }
};

module.exports.newForm = (req, res) => {
  res.render('trips/new');
};

module.exports.createTrip = async (req, res, next) => {
  try {
    if (!req.user) {
      req.flash('error', 'You must be logged in to create a trip');
      return res.redirect('/login');
    }
    const { title, destination } = req.body;
    const owner = req.user._id;
    const trip = new Trip({ title, destination, owner, members: [owner] });
    await trip.save();
    res.redirect(`/trips/${trip._id}`);
  } catch (err) {
    next(err);
  }
};

function computeBalances(expenses, members) {
  // members: array of user objects { _id, username }
  const balances = {};
  const idToName = {};
  members.forEach(m => {
    const id = m._id.toString();
    balances[id] = 0;
    idToName[id] = m.username || m.email || 'Unknown';
  });

  expenses.forEach(exp => {
    const payerId = exp.payer._id.toString();
    let participants = (exp.participants && exp.participants.length) ? exp.participants.map(p => p._id ? p._id.toString() : p.toString()) : members.map(m => m._id.toString());
    const share = exp.amount / participants.length;
    // Each participant owes 'share'
    participants.forEach(pid => {
      balances[pid] = (balances[pid] || 0) - share;
    });
    // Payer paid the whole amount
    balances[payerId] = (balances[payerId] || 0) + exp.amount;
  });

  // Build settlement list: match debtors to creditors
  const creditors = [];
  const debtors = [];
  Object.keys(balances).forEach(id => {
    const amt = Math.round((balances[id] + Number.EPSILON) * 100) / 100;
    if (amt > 0.009) creditors.push({ id, amount: amt });
    else if (amt < -0.009) debtors.push({ id, amount: amt });
  });

  creditors.sort((a,b) => b.amount - a.amount);
  debtors.sort((a,b) => a.amount - b.amount); // more negative first

  const settlements = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const owe = Math.min(creditor.amount, -debtor.amount);
    settlements.push({ from: idToName[debtor.id], to: idToName[creditor.id], amount: Math.round((owe + Number.EPSILON) * 100) / 100 });
    debtor.amount += owe;
    creditor.amount -= owe;
    if (Math.abs(debtor.amount) < 0.01) i++;
    if (Math.abs(creditor.amount) < 0.01) j++;
  }

  // Map balances to names
  const namedBalances = {};
  Object.keys(balances).forEach(id => {
    namedBalances[idToName[id]] = Math.round((balances[id] + Number.EPSILON) * 100) / 100;
  });

  return { balances: namedBalances, settlements };
}

module.exports.showTrip = async (req, res, next) => {
  try {
    const { id } = req.params;
    const trip = await Trip.findById(id).populate('owner').populate('members');
    if (!trip) {
      req.flash('error', 'Trip not found');
      return res.redirect('/trips');
    }
    const expenses = await Expense.find({ trip: id }).populate('payer').populate('participants');
    const members = trip.members;
    const { balances, settlements } = computeBalances(expenses, members);
    res.render('trips/show', { trip, expenses, balances, settlements });
  } catch (err) {
    next(err);
  }
};

module.exports.addMember = async (req, res, next) => {
  try {
    const { id } = req.params; // trip id
    const { usernameOrEmail } = req.body;
    const trip = await Trip.findById(id);
    if (!trip) {
      req.flash('error', 'Trip not found');
      return res.redirect('/trips');
    }
    const user = await User.findOne({ $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }] });
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect(`/trips/${id}`);
    }
    const uid = user._id;
    if (trip.members.map(m => m.toString()).includes(uid.toString())) {
      req.flash('error', 'User already a member');
      return res.redirect(`/trips/${id}`);
    }
    trip.members.push(uid);
    await trip.save();
    req.flash('success', 'Member added');
    res.redirect(`/trips/${id}`);
  } catch (err) {
    next(err);
  }
};

module.exports.addExpense = async (req, res, next) => {
  try {
    const { id } = req.params; // trip id
    const { description, amount, payer, participants } = req.body;
    const trip = await Trip.findById(id);
    if (!trip) {
      req.flash('error', 'Trip not found');
      return res.redirect('/trips');
    }
    const parts = Array.isArray(participants) ? participants : (participants ? [participants] : []);
    const expense = new Expense({ trip: id, payer, amount: Number(amount), description, participants: parts });
    await expense.save();
    req.flash('success', 'Expense added');
    res.redirect(`/trips/${id}`);
  } catch (err) {
    next(err);
  }
};

module.exports.vote = async (req, res, next) => {
  try {
    const { id } = req.params; // trip id
    if (!req.user) {
      req.flash('error', 'Login required');
      return res.redirect('/login');
    }
    const { option } = req.body;
    const vote = new Vote({ trip: id, user: req.user._id, option });
    await vote.save();
    req.flash('success', 'Vote recorded');
    res.redirect(`/trips/${id}`);
  } catch (err) {
    next(err);
  }
};
