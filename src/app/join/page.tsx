"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function JoinPage() {
  const router = useRouter();

  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [team, setTeam] = useState<1 | 2>(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function joinGame(event: FormEvent) {
    event.preventDefault();

    const cleanRoomCode = roomCode.replace(/\D/g, "").slice(0, 6);
    const cleanName = displayName.trim();

    if (cleanRoomCode.length !== 6) {
      setError("Enter the 6-digit room code.");
      return;
    }

    if (!cleanName) {
      setError("Enter your name.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // First make sure the room exists.
      const { data: roomExists, error: roomError } = await supabase.rpc(
        "room_exists",
        {
          p_room_code: cleanRoomCode,
        }
      );

      if (roomError) {
        throw roomError;
      }

      if (!roomExists) {
        setError("That room code does not exist.");
        setLoading(false);
        return;
      }

      // Join the game.
      const { data, error: joinError } = await supabase.rpc(
        "join_friend_feud_game",
        {
          p_room_code: cleanRoomCode,
          p_display_name: cleanName,
          p_team: team,
        }
      );

      if (joinError) {
        throw joinError;
      }

      const player = data?.[0];

      if (!player) {
        throw new Error("Could not join the game.");
      }

      // Save this player's private controller credentials
      // in this browser.
      localStorage.setItem(
        `bald-boy-feud-player-${cleanRoomCode}`,
        JSON.stringify({
          playerId: player.player_id,
          playerToken: player.player_token,
          gameId: player.game_id,
          team: player.team,
          displayName: player.display_name,
          roomCode: cleanRoomCode,
        })
      );

      // Send them to their phone/controller screen.
      router.push(`/play/${cleanRoomCode}`);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while joining the game."
      );

      setLoading(false);
    }
  }

  return (
    <main className="screen">
      <div className="glow glowOne" />
      <div className="glow glowTwo" />

      <section className="card">
        <div className="eyebrow">WELCOME TO</div>

        <div className="logo">
          <span>BALD BOY</span>
          <strong>FEUD</strong>
        </div>

        <div className="divider" />

        <h1>JOIN THE GAME</h1>

        <p className="instructions">
          Enter the room code shown on the game screen.
        </p>

        <form onSubmit={joinGame}>
          <label>
            ROOM CODE
            <input
              className="roomInput"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000000"
              value={roomCode}
              maxLength={6}
              onChange={(event) => {
                setRoomCode(
                  event.target.value.replace(/\D/g, "").slice(0, 6)
                );
                setError("");
              }}
            />
          </label>

          <label>
            YOUR NAME
            <input
              type="text"
              autoComplete="off"
              placeholder="Enter your name"
              value={displayName}
              maxLength={24}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setError("");
              }}
            />
          </label>

          <div className="teamLabel">CHOOSE YOUR TEAM</div>

          <div className="teamButtons">
            <button
              type="button"
              className={`teamButton ${team === 1 ? "selected" : ""}`}
              onClick={() => setTeam(1)}
            >
              <span>TEAM</span>
              <strong>1</strong>
            </button>

            <button
              type="button"
              className={`teamButton ${team === 2 ? "selected" : ""}`}
              onClick={() => setTeam(2)}
            >
              <span>TEAM</span>
              <strong>2</strong>
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          <button
            className="joinButton"
            type="submit"
            disabled={loading}
          >
            {loading ? "JOINING..." : "JOIN GAME"}
          </button>
        </form>

        <div className="footerText">
          Get ready to buzz in.
        </div>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .screen {
          min-height: 100vh;
          width: 100%;
          padding: 25px 16px;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          overflow: hidden;
          color: white;
          background:
            radial-gradient(
              circle at 50% 20%,
              #174f96 0%,
              #08265a 35%,
              #020b1d 75%
            );
          font-family: Arial, Helvetica, sans-serif;
        }

        .glow {
          position: absolute;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.16;
          pointer-events: none;
        }

        .glowOne {
          top: -200px;
          left: -150px;
          background: #ffd557;
        }

        .glowTwo {
          bottom: -200px;
          right: -150px;
          background: #1e78ff;
        }

        .card {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 470px;
          padding: 34px;
          border: 4px solid #d4a12b;
          border-radius: 18px;
          background:
            linear-gradient(
              180deg,
              rgba(10, 43, 92, 0.98),
              rgba(3, 18, 45, 0.98)
            );
          box-shadow:
            inset 0 0 0 3px #5d410d,
            0 25px 70px rgba(0, 0, 0, 0.55),
            0 0 45px rgba(213, 166, 49, 0.12);
        }

        .eyebrow {
          text-align: center;
          color: #d7c27c;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 5px;
        }

        .logo {
          margin-top: 8px;
          text-align: center;
          line-height: 0.92;
          font-weight: 900;
          letter-spacing: 4px;
          text-shadow:
            0 4px 0 #6a4000,
            0 0 20px rgba(255, 204, 70, 0.25);
        }

        .logo span {
          display: block;
          font-size: 31px;
        }

        .logo strong {
          display: block;
          margin-top: 5px;
          color: #ffd557;
          font-size: 59px;
        }

        .divider {
          width: 75%;
          height: 2px;
          margin: 24px auto;
          background:
            linear-gradient(
              90deg,
              transparent,
              #d4a12b,
              transparent
            );
        }

        h1 {
          margin: 0;
          text-align: center;
          font-size: 23px;
          letter-spacing: 3px;
        }

        .instructions {
          margin: 8px 0 28px;
          text-align: center;
          color: #bac7dc;
          font-size: 14px;
        }

        label,
        .teamLabel {
          display: block;
          margin-top: 18px;
          color: #d9c681;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        input {
          width: 100%;
          margin-top: 7px;
          padding: 15px 16px;
          border: 2px solid #8e6a1d;
          border-radius: 8px;
          outline: none;
          background: #041735;
          color: white;
          font-size: 17px;
          font-weight: 700;
          transition: 0.15s;
        }

        input:focus {
          border-color: #ffd557;
          box-shadow: 0 0 0 3px rgba(255, 213, 87, 0.12);
        }

        input::placeholder {
          color: #63728c;
        }

        .roomInput {
          text-align: center;
          font-size: 30px;
          letter-spacing: 10px;
          font-weight: 900;
        }

        .teamButtons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 8px;
        }

        .teamButton {
          min-height: 75px;
          border: 2px solid #536b91;
          border-radius: 9px;
          cursor: pointer;
          color: white;
          background:
            linear-gradient(
              180deg,
              #123b78,
              #082555
            );
          transition:
            transform 0.12s,
            border-color 0.12s,
            box-shadow 0.12s;
        }

        .teamButton:hover {
          transform: translateY(-2px);
        }

        .teamButton span {
          display: block;
          font-size: 10px;
          letter-spacing: 2px;
          color: #aebcd1;
        }

        .teamButton strong {
          display: block;
          margin-top: 2px;
          font-size: 30px;
        }

        .teamButton.selected {
          border-color: #ffd557;
          background:
            linear-gradient(
              180deg,
              #1c559f,
              #0b3470
            );
          box-shadow:
            0 0 18px rgba(255, 213, 87, 0.28),
            inset 0 0 0 2px #8d6816;
        }

        .error {
          margin-top: 18px;
          padding: 11px 13px;
          border: 1px solid #ff5a5a;
          border-radius: 7px;
          background: rgba(126, 0, 0, 0.35);
          color: #ffd7d7;
          font-size: 13px;
          text-align: center;
        }

        .joinButton {
          width: 100%;
          margin-top: 24px;
          padding: 17px;
          border: 3px solid #fff0a5;
          border-radius: 9px;
          cursor: pointer;
          color: #071a3b;
          background:
            linear-gradient(
              180deg,
              #ffe47a,
              #d7a729
            );
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 2px;
          box-shadow:
            0 5px 0 #805a0e,
            0 10px 22px rgba(0, 0, 0, 0.35);
        }

        .joinButton:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .joinButton:active:not(:disabled) {
          transform: translateY(3px);
          box-shadow:
            0 2px 0 #805a0e,
            0 5px 15px rgba(0, 0, 0, 0.35);
        }

        .joinButton:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        .footerText {
          margin-top: 22px;
          text-align: center;
          color: #71819b;
          font-size: 12px;
          letter-spacing: 1px;
        }

        @media (max-width: 520px) {
          .screen {
            align-items: flex-start;
          }

          .card {
            padding: 27px 20px;
          }

          .logo span {
            font-size: 25px;
          }

          .logo strong {
            font-size: 49px;
          }
        }
      `}</style>
    </main>
  );
}