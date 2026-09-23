"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PlayerInfo = {
  playerId: string;
  playerToken: string;
  gameId: string;
  team: number;
  displayName: string;
  roomCode: string;
};

type PublicGame = {
  room_code: string;
  status: string;
  team_one_name: string;
  team_two_name: string;
  team_one_score: number;
  team_two_score: number;
  active_team: number | null;
  current_round: number;
  round_bank: number;
  strikes: number;
  round_multiplier: number;
  question_text: string | null;
};

export default function PlayerPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = use(params);
  const router = useRouter();

  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [game, setGame] = useState<PublicGame | null>(null);
  const [buzzerOpen, setBuzzerOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [buzzing, setBuzzing] = useState(false);
  const [buzzed, setBuzzed] = useState(false);
  const [message, setMessage] = useState("WAITING FOR HOST");
  const [error, setError] = useState("");

  const loadGame = useCallback(async () => {
    const { data: gameData, error: gameError } = await supabase.rpc(
      "get_public_game",
      {
        p_room_code: roomCode,
      }
    );

    if (gameError) {
      setError(gameError.message);
      return;
    }

    const currentGame = gameData?.[0] ?? null;

    if (!currentGame) {
      setError("Game not found.");
      return;
    }

    setGame(currentGame);

    const { data: buzzerData, error: buzzerError } = await supabase.rpc(
      "get_buzzer_status",
      {
        p_room_code: roomCode,
      }
    );

    if (buzzerError) {
      setError(buzzerError.message);
      return;
    }

    const status = buzzerData?.[0]?.buzzer_open ?? false;

    setBuzzerOpen(status);

    if (!status) {
      setBuzzed(false);
      setMessage("WAITING FOR HOST");
    } else if (!buzzed) {
      setMessage("BUZZER OPEN!");
    }

    setError("");
  }, [roomCode, buzzed]);

  useEffect(() => {
    const saved = localStorage.getItem(
      `bald-boy-feud-player-${roomCode}`
    );

    if (!saved) {
      router.replace("/join");
      return;
    }

    try {
      const parsed: PlayerInfo = JSON.parse(saved);

      if (
        !parsed.playerId ||
        !parsed.playerToken ||
        parsed.roomCode !== roomCode
      ) {
        router.replace("/join");
        return;
      }

      setPlayer(parsed);
      setLoading(false);
    } catch {
      router.replace("/join");
    }
  }, [roomCode, router]);

  useEffect(() => {
    if (!player) return;

    loadGame();

    const interval = window.setInterval(() => {
      loadGame();
    }, 600);

    return () => window.clearInterval(interval);
  }, [player, loadGame]);

  async function buzz() {
    if (!player || !buzzerOpen || buzzing || buzzed) return;

    setBuzzing(true);
    setError("");

    if (navigator.vibrate) {
      navigator.vibrate(60);
    }

    const { data, error: buzzError } = await supabase.rpc(
      "submit_buzz",
      {
        p_player_id: player.playerId,
        p_player_token: player.playerToken,
      }
    );

    if (buzzError) {
      setError(buzzError.message);
      setBuzzing(false);
      return;
    }

    if (data === true) {
      setBuzzed(true);
      setMessage("BUZZED IN!");
      setBuzzerOpen(false);

      if (navigator.vibrate) {
        navigator.vibrate([100, 60, 100]);
      }
    } else {
      setBuzzed(true);
      setMessage("TOO LATE!");
      setBuzzerOpen(false);
    }

    setBuzzing(false);
  }

  function leaveGame() {
    localStorage.removeItem(
      `bald-boy-feud-player-${roomCode}`
    );

    router.push("/join");
  }

  if (loading) {
    return (
      <main className="center">
        <h1>BALD BOY FEUD</h1>
        <p>Loading controller...</p>

        <style jsx>{styles}</style>
      </main>
    );
  }

  if (!player) {
    return null;
  }

  const teamName =
    player.team === 1
      ? game?.team_one_name ?? "Team 1"
      : game?.team_two_name ?? "Team 2";

  return (
    <main className="screen">
      <header>
        <div>
          <div className="small">BALD BOY</div>
          <div className="logo">FEUD</div>
        </div>

        <div className="room">
          ROOM
          <strong>{roomCode}</strong>
        </div>
      </header>

      <section className="playerCard">
        <div className="small">PLAYING AS</div>

        <div className="playerName">
          {player.displayName}
        </div>

        <div className="teamName">
          {teamName}
        </div>
      </section>

      {game?.question_text && (
        <section className="question">
          <span>QUESTION</span>
          <strong>{game.question_text}</strong>
        </section>
      )}

      <section className="buzzerArea">
        <div
          className={`status ${
            buzzerOpen && !buzzed ? "openStatus" : ""
          }`}
        >
          {message}
        </div>

        <button
          type="button"
          className={`buzzer ${
            buzzerOpen && !buzzed ? "ready" : ""
          } ${buzzed ? "buzzed" : ""}`}
          disabled={!buzzerOpen || buzzing || buzzed}
          onClick={buzz}
        >
          <span>
            {buzzing
              ? "..."
              : buzzed
              ? "LOCKED"
              : buzzerOpen
              ? "BUZZ!"
              : "WAIT"}
          </span>
        </button>

        <div className="hint">
          {buzzerOpen && !buzzed
            ? "HIT THE BUTTON!"
            : "The host controls when the buzzer opens."}
        </div>
      </section>

      {game && (
        <section className="gameInfo">
          <div>
            <span>ROUND</span>
            <strong>{game.current_round}</strong>
          </div>

          <div>
            <span>BANK</span>
            <strong>{game.round_bank}</strong>
          </div>

          <div>
            <span>STRIKES</span>
            <strong>{game.strikes}</strong>
          </div>
        </section>
      )}

      {error && <div className="error">{error}</div>}

      <button
        type="button"
        className="leave"
        onClick={leaveGame}
      >
        LEAVE GAME
      </button>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .screen,
  .center {
    min-height: 100vh;
    background:
      radial-gradient(
        circle at 50% 20%,
        #174f96,
        #071e48 45%,
        #020a1b 100%
      );
    color: white;
    font-family: Arial, Helvetica, sans-serif;
  }

  .screen {
    max-width: 600px;
    margin: auto;
    padding: 22px 18px 35px;
  }

  .center {
    display: grid;
    place-content: center;
    text-align: center;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .small {
    color: #d5c27e;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 3px;
  }

  .logo {
    color: #ffd557;
    font-size: 42px;
    font-weight: 900;
    letter-spacing: 3px;
    line-height: .9;
    text-shadow: 0 3px 0 #704800;
  }

  .room {
    text-align: right;
    color: #b6c1d3;
    font-size: 9px;
    letter-spacing: 2px;
  }

  .room strong {
    display: block;
    margin-top: 3px;
    color: #ffd557;
    font-size: 21px;
    letter-spacing: 3px;
  }

  .playerCard {
    margin-top: 25px;
    padding: 16px;
    border: 2px solid #b98b23;
    border-radius: 10px;
    background: #071d43;
    text-align: center;
  }

  .playerName {
    margin-top: 4px;
    font-size: 27px;
    font-weight: 900;
  }

  .teamName {
    margin-top: 5px;
    color: #ffd557;
    font-size: 14px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .question {
    margin-top: 16px;
    padding: 15px;
    border: 2px solid #86651c;
    border-radius: 9px;
    background: #04152f;
    text-align: center;
  }

  .question span {
    display: block;
    margin-bottom: 6px;
    color: #d5c27e;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 2px;
  }

  .question strong {
    font-size: 16px;
    text-transform: uppercase;
  }

  .buzzerArea {
    margin-top: 25px;
    text-align: center;
  }

  .status {
    min-height: 29px;
    color: #8998af;
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 2px;
  }

  .openStatus {
    color: #ffd557;
    animation: pulseText .7s infinite alternate;
  }

  .buzzer {
    width: min(68vw, 300px);
    height: min(68vw, 300px);
    max-width: 300px;
    max-height: 300px;
    margin-top: 14px;
    border: 13px solid #4b4b4b;
    border-radius: 50%;
    background:
      radial-gradient(
        circle at 40% 30%,
        #737373,
        #373737 45%,
        #161616 75%
      );
    color: #999;
    cursor: not-allowed;
    box-shadow:
      0 15px 0 #111,
      0 25px 35px rgba(0, 0, 0, .55);
    transition:
      transform .08s,
      box-shadow .08s;
  }

  .buzzer span {
    font-size: clamp(31px, 9vw, 54px);
    font-weight: 900;
    letter-spacing: 2px;
  }

  .buzzer.ready {
    border-color: #ffb3b3;
    background:
      radial-gradient(
        circle at 38% 28%,
        #ff7676,
        #df1717 43%,
        #8d0000 75%
      );
    color: white;
    cursor: pointer;
    box-shadow:
      0 15px 0 #570000,
      0 25px 35px rgba(0, 0, 0, .55),
      0 0 45px rgba(255, 30, 30, .5);
    animation: buzzerGlow .65s infinite alternate;
  }

  .buzzer.ready:active {
    transform: translateY(10px);
    box-shadow:
      0 5px 0 #570000,
      0 12px 20px rgba(0, 0, 0, .5);
  }

  .buzzer.buzzed {
    border-color: #d8aa32;
  }

  .hint {
    margin-top: 24px;
    color: #9cabc1;
    font-size: 13px;
  }

  .gameInfo {
    margin-top: 28px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .gameInfo div {
    padding: 11px;
    border: 1px solid #53678a;
    border-radius: 7px;
    background: #061936;
    text-align: center;
  }

  .gameInfo span {
    display: block;
    color: #9aa9bf;
    font-size: 8px;
    letter-spacing: 1px;
  }

  .gameInfo strong {
    display: block;
    margin-top: 3px;
    color: #ffd557;
    font-size: 23px;
  }

  .error {
    margin-top: 18px;
    padding: 12px;
    border: 1px solid #ff6262;
    border-radius: 7px;
    background: rgba(120, 0, 0, .35);
    color: #ffd7d7;
    text-align: center;
    font-size: 13px;
  }

  .leave {
    display: block;
    margin: 28px auto 0;
    border: 0;
    background: transparent;
    color: #687a95;
    cursor: pointer;
    font-size: 10px;
    letter-spacing: 2px;
  }

  @keyframes buzzerGlow {
    from {
      transform: scale(1);
    }

    to {
      transform: scale(1.025);
    }
  }

  @keyframes pulseText {
    from {
      opacity: .7;
    }

    to {
      opacity: 1;
    }
  }
`;