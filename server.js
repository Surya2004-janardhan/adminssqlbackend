const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Create a MySQL connection (not pool)
const db = mysql.createConnection({
  host: "database-1.cx84e20u4106.eu-north-1.rds.amazonaws.com",
  user: "admin",
  password: "adityafoods", // Set your MySQL password
  database: "food_app_admin",
  port: 3306,
});

// ✅ Connect to database
db.connect((err) => {
  if (err) {
    console.error("Database connection failed: " + err.stack);
    return;
  }
  console.log("Connected to MySQL database");
});

// ✅ Get all food items for admin with user_id = 1
app.get("/admins/:id/food-items", (req, res) => {
  const adminId = req.params.id;
  db.query(
    "SELECT * FROM food_items WHERE admin_id = ?",
    [adminId],
    (err, result) => {
      if (err) {
        console.error("Error fetching food items:", err.message);
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json(result);
    }
  );
});

// ✅ Update food availability
app.put("/food-items/:id", (req, res) => {
  const foodItemId = req.params.id;
  const { available } = req.body;

  db.query(
    "UPDATE food_items SET available = ? WHERE id = ?",
    [available, foodItemId],
    (err, result) => {
      if (err) {
        console.error("Error updating food item:", err.message);
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ message: "Food item updated" });
    }
  );
});

// ✅ Add new food item
app.post("/food-items", (req, res) => {
  const { name, description, price, image_url, available, admin_id } = req.body;

  if (!name || !description || !price || !image_url || admin_id == null) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const sql = `
    INSERT INTO food_items (name, description, price, image_url, available, admin_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [name, description, price, image_url, available, admin_id],
    (err, result) => {
      if (err) {
        console.error("Error inserting food item:", err.message);
        return res.status(500).json({ error: "Failed to insert food item" });
      }
      res.status(201).json({ message: "Food item added successfully", id: result.insertId });
    }
  );
});



app.get("/orders", (req, res) => {
  db.query("SELECT * FROM orders", async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    const ordersWithItems = await Promise.all(
      results.map(async (order) => {
        const [items] = await db.promise().query(
          "SELECT name, quantity FROM order_items WHERE order_id = ?",
          [order.id]
        );
        return { ...order, items };
      })
    );

    res.json(ordersWithItems);
  });
});

app.post("/orders/:id/verify", (req, res) => {
  const { id } = req.params;
  const { otp } = req.body;

  db.query("SELECT otp FROM orders WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length > 0 && results[0].otp === otp) {
      return res.json({ success: true });
    } else {
      return res.json({ success: false });
    }
  });
});

app.put("/orders/:id/complete", (req, res) => {
  const { id } = req.params;
  db.query(
    "UPDATE orders SET status = 'completed' WHERE id = ?",
    [id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});


app.post("/admin/login", async (req, res) => {
  const { id, password } = req.body;

  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM admins WHERE id = ? AND password = ?",
      [id, password]
    );

    if (rows.length > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.post("/verify-token", (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, message: "Token is required" });
  }

  db.query(
    "SELECT admin_id FROM tokens WHERE token = ? LIMIT 1",
    [token],
    (err, results) => {
      if (err) {
        console.error("💥 Error verifying token:", err);
        return res.status(500).json({ valid: false, message: "Server error" });
      }

      if (results.length > 0) {
        const admin_id = results[0].admin_id;
        return res.json({ valid: true, admin_id });
      } else {
        return res.status(401).json({ valid: false, message: "Invalid or expired token" });
      }
    }
  );
});


app.post('/store-token', (req, res) => {
  const { admin_id, token } = req.body;

  // Assuming `db.query` uses callback-based syntax
  db.query(
    'INSERT INTO tokens (admin_id, token) VALUES (?, ?)',
    [admin_id, token],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: 'DB Error' });
      }
      res.json({ success: true });
    }
  );
});


app.delete('/delete-token', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: "Token is required" });
  }

  db.query(
    'DELETE FROM tokens WHERE token = ?',
    [token],
    (err, results) => {
      if (err) {
        console.error("DB error during token deletion:", err);
        return res.status(500).json({ success: false, message: "Database error" });
      }

      res.json({ success: true });
    }
  );
});

// ✅ Start server
app.listen(5000, () => {
  console.log("Server running on port 5000");
});
