const { pool } = require('../config/database'); // Adjust the path as needed
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET || 'e04fdc13703955ca5130251b0f919b6d082ba6919938869c4f3661ca2d569641'; // Use an environment variable for production

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body; // Get input from request body

    // Check if the user already exists
    const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new user into the database
    await pool.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [
      name,
      email,
      hashedPassword,
    ]);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ message: 'Error signing up user' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Check for missing fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find the user by email
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id, isAdmin: user.isAdmin }, jwtSecret);

    res.json({ token, userId: user.id, userName: user.name, isAdmin: user.isAdmin });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Error logging in user' });
  }
};

const getUsers = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, isAdmin FROM users');
    res.json(rows);  // Return the list of users
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

const makeAdmin = async (req, res) => {
  try {
    const { userId } = req.params;  // Get user ID from request params
    const { isAdmin } = req.body;    // Expect `isAdmin` field in the body

    if (typeof isAdmin !== 'boolean') {
      return res.status(400).json({ message: 'Invalid isAdmin value' });
    }

    // Update user's isAdmin status
    const [result] = await pool.query('UPDATE users SET isAdmin = ? WHERE id = ?', [isAdmin, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User admin status updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user admin status' });
  }
};


module.exports = { signup, login, getUsers, makeAdmin };

