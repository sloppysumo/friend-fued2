"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

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

type BoardAnswer = {
  answer_position: number;
  answer_text: string | null;
  answer_points: number | null;
  is_revealed: boolean;
};

export default function PublicGamePage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = use(params);

  const [game, setGame] = useState<PublicGame | null>(null);
  const [answers, setAnswers] = useState<BoardAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showStrike, setShowStrike] = useState(false);

  const previousStrikes = useRef(0);
  const firstLoad = useRef(true);

  const loadBoard = useCallback(async () => {
    const { data: gameData, error: gameError } = await supabase.rpc(
      "get_public_game",
      {
        p_room_code: roomCode,
      }
    );

    if (gameError) {
      setError(gameError.message);
      setLoading(false);
      return;
    }

    const currentGame = gameData?.[0] ?? null;

    if (!currentGame) {
      setError("Game not found.");
      setLoading(false);
      return;
    }

    setGame(currentGame);

    const { data: boardData, error: boardError } = await supabase.rpc(
      "get_public_board",
      {
        p_room_code: roomCode,
      }
    );

    if (boardError) {
      setError(boardError.message);
      setLoading(false);
      return;
    }

    setAnswers(boardData ?? []);

    const newStrikes = currentGame.strikes ?? 0;

    if (!firstLoad.current && newStrikes > previousStrikes.current) {
      setShowStrike(true);

      window.setTimeout(() => {
        setShowStrike(false);
      }, 900);
    }

    previousStrikes.current = newStrikes;
    firstLoad.current = false;

    setError("");
    setLoading(false);
  }, [roomCode]);

  useEffect(() => {
    loadBoard();

    // Polling keeps the public board synced without giving it
    // direct access to the private database tables.
    const interval = window.setInterval(() => {
      loadBoard();
    }, 750);

    return () => window.clearInterval(interval);
  }, [loadBoard]);

  if (loading) {
    return (
      <main className="loadingScreen">
        <div className="loadingLogo">BALD BOY FEUD</div>
        <div className="loadingText">Loading game...</div>

        <style jsx>{styles}</style>
      </main>
    );
  }

  if (error || !game) {
    return (
      <main className="loadingScreen">
        <div className="loadingLogo">BALD BOY FEUD</div>
        <div className="errorBox">{error || "Game not found."}</div>

        <style jsx>{styles}</style>
      </main>
    );
  }

  const visibleAnswers =
    answers.length > 0
      ? answers
      : Array.from({ length: 6 }, (_, index) => ({
          answer_position: index + 1,
          answer_text: null,
          answer_points: null,
          is_revealed: false,
        }));

  return (
    <main className="screen">
      {showStrike && (
        <div className="strikeOverlay">
          {Array.from(
            { length: Math.max(1, Math.min(game.strikes, 3)) },
            (_, index) => (
              <span key={index}>X</span>
            )
          )}
        </div>
      )}

      <header className="header">
        <div className="room">
          ROOM
          <strong>{game.room_code}</strong>
        </div>

        <div className="logo">
          <span>BALD BOY</span>
          <strong>FEUD</strong>
        </div>

        <div className="round">
          ROUND
          <strong>{game.current_round}</strong>
        </div>
      </header>

      <section className="scoreRow">
        <div
          className={`teamCard ${game.active_team === 1 ? "activeTeam" : ""}`}
        >
          <div className="teamName">{game.team_one_name}</div>
          <div className="teamScore">{game.team_one_score}</div>
        </div>

        <div className="bank">
          <span>ROUND BANK</span>
          <strong>{game.round_bank}</strong>

          {game.round_multiplier > 1 && (
            <div className="multiplier">{game.round_multiplier}X POINTS</div>
          )}
        </div>

        <div
          className={`teamCard ${game.active_team === 2 ? "activeTeam" : ""}`}
        >
          <div className="teamName">{game.team_two_name}</div>
          <div className="teamScore">{game.team_two_score}</div>
        </div>
      </section>

      <section className="question">
        {game.question_text || "WAITING FOR THE HOST..."}
      </section>

      <section className="board">
        {visibleAnswers.map((answer) => (
          <div
            className={`answer ${
              answer.is_revealed ? "revealed" : "hiddenAnswer"
            }`}
            key={answer.answer_position}
          >
            {answer.is_revealed ? (
              <>
                <div className="answerText">{answer.answer_text}</div>
                <div className="points">{answer.answer_points}</div>
              </>
            ) : (
              <div className="number">{answer.answer_position}</div>
            )}
          </div>
        ))}
      </section>

      <section className="bottom">
        <div className="strikeCounter">
          <span>STRIKES</span>

          <div className="xs">
            {[1, 2, 3].map((strike) => (
              <strong
                key={strike}
                className={game.strikes >= strike ? "usedStrike" : ""}
              >
                X
              </strong>
            ))}
          </div>
        </div>

        <div className="status">
          {game.status === "faceoff" && "FACE OFF"}
          {game.status === "playing" && "PLAYING"}
          {game.status === "steal" && "STEAL"}
          {game.status === "lobby" && "GET READY"}
          {game.status === "fast_money" && "FAST MONEY"}
          {game.status === "finished" && "FINAL"}
        </div>
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .screen {
    min-height: 100vh;
    width: 100%;
    overflow: hidden;
    padding: 24px 32px 38px;
    color: #fff7d6;
    background:
      radial-gradient(circle at 50% 30%, #123d79 0%, #071e46 42%, #020b1d 100%);
    font-family: Arial, Helvetica, sans-serif;
    position: relative;
  }

  .header {
    max-width: 1400px;
    margin: 0 auto 22px;
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;
    align-items: center;
  }

  .logo {
    text-align: center;
    font-weight: 900;
    letter-spacing: 5px;
    line-height: .92;
    text-shadow: 0 4px 0 #6d4100, 0 0 25px rgba(255, 197, 66, .35);
  }

  .logo span {
    display: block;
    font-size: clamp(25px, 3vw, 45px);
  }

  .logo strong {
    display: block;
    font-size: clamp(45px, 5.5vw, 82px);
    color: #ffd45a;
  }

  .room,
  .round {
    font-size: 13px;
    letter-spacing: 3px;
    color: #d9c17b;
  }

  .room strong,
  .round strong {
    display: block;
    margin-top: 5px;
    color: white;
    font-size: clamp(22px, 2.5vw, 36px);
    letter-spacing: 4px;
  }

  .round {
    text-align: right;
  }

  .scoreRow {
    max-width: 1300px;
    margin: 0 auto 20px;
    display: grid;
    grid-template-columns: 1fr .65fr 1fr;
    gap: 16px;
    align-items: stretch;
  }

  .teamCard,
  .bank {
    border: 4px solid #d9a82e;
    border-radius: 12px;
    background: linear-gradient(180deg, #0d3470, #061b3e);
    box-shadow:
      inset 0 0 0 3px #573b08,
      0 7px 20px rgba(0, 0, 0, .4);
    text-align: center;
  }

  .teamCard {
    padding: 14px;
    transition: .2s;
  }

  .activeTeam {
    border-color: #ffe58a;
    box-shadow:
      inset 0 0 0 3px #8d650f,
      0 0 24px rgba(255, 211, 83, .55);
  }

  .teamName {
    font-size: clamp(16px, 2vw, 27px);
    font-weight: 900;
    text-transform: uppercase;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .teamScore {
    color: #ffd557;
    font-size: clamp(38px, 5vw, 70px);
    font-weight: 900;
    line-height: 1;
    margin-top: 8px;
  }

  .bank {
    padding: 12px;
  }

  .bank span {
    display: block;
    font-size: 12px;
    letter-spacing: 2px;
    color: #d9c17b;
  }

  .bank strong {
    display: block;
    font-size: clamp(38px, 5vw, 65px);
    color: #ffd557;
    line-height: 1.05;
    margin-top: 5px;
  }

  .multiplier {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1px;
    margin-top: 5px;
  }

  .question {
    max-width: 1200px;
    margin: 0 auto 20px;
    padding: 18px 25px;
    border: 4px solid #d8a62a;
    border-radius: 10px;
    background: #071b3d;
    text-align: center;
    text-transform: uppercase;
    font-size: clamp(20px, 2.7vw, 38px);
    font-weight: 900;
    box-shadow:
      inset 0 0 0 3px #5e410d,
      0 8px 25px rgba(0, 0, 0, .45);
  }

  .board {
    max-width: 1100px;
    margin: auto;
    padding: 22px;
    border: 6px solid #c79420;
    border-radius: 14px;
    background: #03132e;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 13px;
    box-shadow:
      inset 0 0 30px rgba(0, 0, 0, .8),
      0 10px 30px rgba(0, 0, 0, .5);
  }

  .answer {
    min-height: 72px;
    border: 3px solid #b8841c;
    border-radius: 7px;
    display: flex;
    align-items: center;
    overflow: hidden;
  }

  .hiddenAnswer {
    justify-content: center;
    background: linear-gradient(180deg, #16498a, #0b2e61);
  }

  .number {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #f4c84e;
    color: #071a3a;
    display: grid;
    place-items: center;
    font-size: 27px;
    font-weight: 900;
    box-shadow: 0 0 0 4px #795313;
  }

  .revealed {
    background: linear-gradient(180deg, #fff1b0, #e8b944);
    color: #071a3a;
  }

  .answerText {
    flex: 1;
    padding: 10px 18px;
    font-size: clamp(17px, 2vw, 28px);
    font-weight: 900;
    text-transform: uppercase;
  }

  .points {
    min-width: 85px;
    align-self: stretch;
    border-left: 3px solid #9b6c14;
    display: grid;
    place-items: center;
    font-size: clamp(25px, 3vw, 40px);
    font-weight: 900;
  }

  .bottom {
    max-width: 1100px;
    margin: 20px auto 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .strikeCounter {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .strikeCounter > span {
    font-size: 12px;
    letter-spacing: 2px;
    color: #d9c17b;
  }

  .xs {
    display: flex;
    gap: 8px;
  }

  .xs strong {
    font-size: 30px;
    color: #273954;
  }

  .xs .usedStrike {
    color: #ff2929;
    text-shadow: 0 0 12px red;
  }

  .status {
    color: #ffd557;
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 3px;
  }

  .strikeOverlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 35px;
    pointer-events: none;
    background: rgba(0, 0, 0, .12);
  }

  .strikeOverlay span {
    color: #ff1717;
    font-size: clamp(150px, 25vw, 350px);
    font-weight: 900;
    line-height: 1;
    -webkit-text-stroke: 10px #8c0000;
    text-shadow:
      0 0 12px white,
      0 0 35px red,
      10px 10px 0 #3b0000;
    animation: strikePop .9s ease-out forwards;
  }

  @keyframes strikePop {
    0% {
      transform: scale(2.3);
      opacity: 0;
    }

    15% {
      transform: scale(.9);
      opacity: 1;
    }

    28% {
      transform: scale(1.08);
    }

    80% {
      opacity: 1;
    }

    100% {
      transform: scale(1);
      opacity: 0;
    }
  }

  .loadingScreen {
    min-height: 100vh;
    background:
      radial-gradient(circle at center, #123d79, #020b1d 70%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: white;
    font-family: Arial, Helvetica, sans-serif;
  }

  .loadingLogo {
    color: #ffd557;
    font-size: clamp(35px, 6vw, 75px);
    font-weight: 900;
    letter-spacing: 5px;
  }

  .loadingText {
    margin-top: 15px;
    letter-spacing: 3px;
  }

  .errorBox {
    margin-top: 25px;
    max-width: 700px;
    padding: 20px;
    border: 2px solid #e0ae32;
    border-radius: 8px;
    background: #071b3d;
  }

  @media (max-width: 700px) {
    .screen {
      padding: 15px;
    }

    .header {
      grid-template-columns: 1fr 1.5fr 1fr;
    }

    .scoreRow {
      grid-template-columns: 1fr 1fr;
    }

    .bank {
      grid-column: 1 / 3;
      grid-row: 2;
    }

    .board {
      grid-template-columns: 1fr;
      padding: 12px;
    }

    .answer {
      min-height: 58px;
    }
  }
`;
