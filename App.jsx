// frontend/src/App.jsx

import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000';

function App() {
  const [habitName, setHabitName] = useState('');
  const [habits, setHabits] = useState([]);
  const [checkinsByHabit, setCheckinsByHabit] = useState({});
  const [loading, setLoading] = useState(true);

  const getToday = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getLastSevenDays = () => {
    const days = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      days.push({
        fullDate: date.toISOString().split('T')[0],
        dayNumber: date.getDate()
      });
    }

    return days;
  };

  async function refreshAll() {
    try {
      const habitsResponse = await fetch(`${API_URL}/habits`);
      const habitsData = await habitsResponse.json();

      const checkinsMap = {};

      for (const habit of habitsData) {
        try {
          const checkinsResponse = await fetch(
            `${API_URL}/habits/${habit.id}/checkins`
          );

          const checkins = await checkinsResponse.json();

          checkinsMap[habit.id] = checkins;
        } catch (error) {
          console.error(error);
        }
      }

      setHabits(habitsData);
      setCheckinsByHabit(checkinsMap);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function handleAddHabit() {
    const trimmedName = habitName.trim();

    if (!trimmedName) {
      return;
    }

    try {
      await fetch(`${API_URL}/habits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: trimmedName
        })
      });

      setHabitName('');
      await refreshAll();
    } catch (error) {
      console.error(error);
    }
  }

  async function handleCheckIn(habitId) {
    try {
      await fetch(`${API_URL}/habits/${habitId}/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      await refreshAll();
    } catch (error) {
      console.error(error);
    }
  }

  async function handleDeleteHabit(habitId) {
    try {
      await fetch(`${API_URL}/habits/${habitId}`, {
        method: 'DELETE'
      });

      await refreshAll();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="container">
      <h1>🔥 Habit Tracker</h1>

      <div className="new-habit-card">
        <div className="input-row">
          <input
            type="text"
            placeholder="e.g. Drink 2L water"
            value={habitName}
            onChange={(e) => setHabitName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddHabit();
              }
            }}
          />

          <button onClick={handleAddHabit}>
            Add Habit
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading your habits...</p>
      ) : habits.length === 0 ? (
        <p>No habits yet. Add one above to get started!</p>
      ) : (
        habits.map((habit) => {
          const checkins =
            checkinsByHabit[habit.id] || [];

          const checkedToday = checkins.includes(
            getToday()
          );

          return (
            <div
              key={habit.id}
              className="habit-card"
            >
              <h3>{habit.name}</h3>

              <p
                className={
                  habit.streak > 0
                    ? 'streak streak-active'
                    : 'streak'
                }
              >
                {habit.streak > 0
                  ? `🔥 ${habit.streak} day streak`
                  : 'No streak yet — check in today!'}
              </p>

              <button
                className="checkin-btn"
                disabled={checkedToday}
                onClick={() =>
                  handleCheckIn(habit.id)
                }
              >
                {checkedToday
                  ? '✅ Checked in today'
                  : 'Check In'}
              </button>

              <div className="history-row">
                {getLastSevenDays().map((day) => (
                  <div
                    key={day.fullDate}
                    className={`history-box ${checkins.includes(day.fullDate)
                      ? 'done'
                      : 'not-done'
                      }`}
                  >
                    {day.dayNumber}
                  </div>
                ))}
              </div>

              <button
                className="delete-btn"
                onClick={() =>
                  handleDeleteHabit(habit.id)
                }
              >
                Delete Habit
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

export default App;