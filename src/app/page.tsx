"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");

  function joinGame() {
    const code = roomCode.trim();

    if (!code) {
      return;
    }

    router.push(`/join?room=${encodeURIComponent(code)}`);
  }

  return (
    <main className="home-page">
      <div className="light light-one" />
      <div className="light light-two" />

      <section className="home-card">
        <div className="logo-small">WELCOME TO</div>

        <h1 className="friend-feud-logo">
          <span>BALD BOY</span>
          <span>FEUD</span>
        </h1>

        <p className="tagline">
          Survey says... eat a honeybun
        </p>

        <div className="home-actions">
          <button
            className="game-button host-button"
            onClick={() => router.push("/login")}
          >
            HOST A GAME
          </button>

          <div className="divider">
            <span />
            <p>OR</p>
            <span />
          </div>

          <div className="join-box">
            <label htmlFor="roomCode">ENTER ROOM CODE</label>

            <input
              id="roomCode"
              value={roomCode}
              onChange={(event) =>
                setRoomCode(event.target.value.toUpperCase())
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  joinGame();
                }
              }}
              placeholder="123456"
              maxLength={6}
            />

            <button
              className="game-button join-button"
              onClick={joinGame}
            >
              JOIN GAME
            </button>
          </div>
        </div>

        <p className="footer-message">
          Grab your friends. Pick your teams. Hit the buzzer.
        </p>
      </section>
    </main>
  );
}