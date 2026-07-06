// backend/index.js

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();

app.use(cors());
app.use(express.json());

const db = new Database('data.db');

// Create the habits table if it does not already exist.
db.exec(`
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

// Create the checkins table if it does not already exist.
db.exec(`
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    UNIQUE(habit_id, date)
  )
`);

function getDateString(date) {
    return date.toISOString().split('T')[0];
}

// Calculates a streak by counting consecutive checked-in days from today,
// or from yesterday if today is not checked in yet, moving backwards one day at a time.
function calculateStreak(habitId) {
    const rows = db
        .prepare(`
      SELECT date
      FROM checkins
      WHERE habit_id = ?
      ORDER BY date DESC
    `)
        .all(habitId);

    const dates = new Set(rows.map((row) => row.date));

    const today = new Date();
    const todayStr = getDateString(today);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getDateString(yesterday);

    let startDate = null;

    if (dates.has(todayStr)) {
        startDate = new Date(today);
    } else if (dates.has(yesterdayStr)) {
        startDate = new Date(yesterday);
    } else {
        return 0;
    }

    let streak = 0;
    const current = new Date(startDate);

    while (dates.has(getDateString(current))) {
        streak++;
        current.setDate(current.getDate() - 1);
    }

    return streak;
}

// Create a new habit.
app.post('/habits', (req, res) => {
    const name = (req.body.name || '').trim();

    if (!name) {
        return res.status(400).json({
            error: 'name is required'
        });
    }

    const created_at = new Date().toISOString();

    const result = db
        .prepare(`
      INSERT INTO habits (name, created_at)
      VALUES (?, ?)
    `)
        .run(name, created_at);

    const habit = db
        .prepare('SELECT * FROM habits WHERE id = ?')
        .get(result.lastInsertRowid);

    res.status(201).json({
        ...habit,
        streak: 0
    });
});

// List all habits with their current streak values.
app.get('/habits', (req, res) => {
    const habits = db
        .prepare(`
      SELECT *
      FROM habits
      ORDER BY created_at ASC
    `)
        .all();

    const data = habits.map((habit) => ({
        ...habit,
        streak: calculateStreak(habit.id)
    }));

    res.status(200).json(data);
});

// Record a check-in for a habit on a given date.
app.post('/habits/:id/checkin', (req, res) => {
    const habitId = Number(req.params.id);

    const habit = db
        .prepare('SELECT * FROM habits WHERE id = ?')
        .get(habitId);

    if (!habit) {
        return res.status(404).json({
            error: 'Habit not found'
        });
    }

    const date =
        req.body.date ||
        getDateString(new Date());

    const checked_at = new Date().toISOString();

    try {
        const result = db
            .prepare(`
        INSERT INTO checkins (habit_id, date, checked_at)
        VALUES (?, ?, ?)
      `)
            .run(habitId, date, checked_at);

        const checkin = db
            .prepare('SELECT * FROM checkins WHERE id = ?')
            .get(result.lastInsertRowid);

        res.status(201).json({
            ...checkin,
            streak: calculateStreak(habitId)
        });
    } catch (error) {
        if (
            error.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
            error.code === 'SQLITE_CONSTRAINT'
        ) {
            return res.status(409).json({
                error: 'Already checked in for this date'
            });
        }

        throw error;
    }
});

// Return all check-in dates for a single habit.
app.get('/habits/:id/checkins', (req, res) => {
    const habitId = Number(req.params.id);

    const habit = db
        .prepare('SELECT * FROM habits WHERE id = ?')
        .get(habitId);

    if (!habit) {
        return res.status(404).json({
            error: 'Habit not found'
        });
    }

    const dates = db
        .prepare(`
      SELECT date
      FROM checkins
      WHERE habit_id = ?
      ORDER BY date DESC
    `)
        .all(habitId)
        .map((row) => row.date);

    res.status(200).json(dates);
});

// Remove a specific check-in for a habit and date.
app.delete('/habits/:id/checkin/:date', (req, res) => {
    const habitId = Number(req.params.id);
    const date = req.params.date;

    db.prepare(`
    DELETE FROM checkins
    WHERE habit_id = ?
    AND date = ?
  `).run(habitId, date);

    res.status(200).json({
        message: 'Checkin removed'
    });
});

// Delete a habit and all of its check-in history.
app.delete('/habits/:id', (req, res) => {
    const habitId = Number(req.params.id);

    db.prepare(`
    DELETE FROM checkins
    WHERE habit_id = ?
  `).run(habitId);

    db.prepare(`
    DELETE FROM habits
    WHERE id = ?
  `).run(habitId);

    res.status(200).json({
        message: `Habit ${habitId} and its checkins deleted`
    });
});

app.listen(5000, () => {
    console.log('Server running on http://localhost:5000');
});