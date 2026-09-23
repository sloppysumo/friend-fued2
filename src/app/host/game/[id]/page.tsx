"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Game = {
  id: string;
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
  buzzer_open: boolean;
};

type Pack = {
  pack_id: string;
  pack_name: string;
  pack_description?: string | null;
};

type Question = {
  question_id: string;
  question_text: string;
  sort_order?: number;
};

type Answer = {
  answer_position: number;
  answer_text: string;
  answer_points: number;
  is_revealed?: boolean;
};

type Buzz = {
  player_name: string;
  player_team: number;
  buzz_time: string;
};

export default function GameControlPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [buzzes, setBuzzes] = useState<Buzz[]>([]);

  const [selectedPack, setSelectedPack] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState("");

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const loadGame = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setGame(data as Game);
    setLoading(false);
  }, [id, router]);

  const loadPacks = useCallback(async () => {
    const { data, error } = await supabase.rpc("host_get_question_packs");

    if (error) {
      console.error(error);
      return;
    }

    const rows = (data ?? []) as Pack[];
    setPacks(rows);

    if (rows.length > 0) {
      setSelectedPack((current) => current || rows[0].pack_id);
    }
  }, []);

  const loadQuestions = useCallback(async (packId: string) => {
    if (!packId) {
      setQuestions([]);
      return;
    }

    const { data, error } = await supabase.rpc("host_get_questions", {
      p_pack_id: packId,
    });

    if (error) {
      setError(error.message);
      return;
    }

    const rows = (data ?? []) as Question[];
    setQuestions(rows);

    if (rows.length > 0) {
      setSelectedQuestion(rows[0].question_id);
    } else {
      setSelectedQuestion("");
    }
  }, []);

  const loadAnswers = useCallback(async (questionId: string) => {
    if (!questionId) {
      setAnswers([]);
      return;
    }

    const { data, error } = await supabase.rpc("host_get_question_answers", {
      p_question_id: questionId,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setAnswers((data ?? []) as Answer[]);
  }, []);

  const loadBuzzes = useCallback(async () => {
    const { data, error } = await supabase.rpc("host_get_buzzes", {
      p_game_id: id,
    });

    if (!error) {
      setBuzzes((data ?? []) as Buzz[]);
    }
  }, [id]);

  useEffect(() => {
    loadGame();
    loadPacks();
    loadBuzzes();

    const channel = supabase
      .channel(`host-game-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `id=eq.${id}`,
        },
        () => {
          loadGame();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "buzzes",
          filter: `game_id=eq.${id}`,
        },
        () => {
          loadBuzzes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, loadGame, loadPacks, loadBuzzes]);

  useEffect(() => {
    if (selectedPack) {
      loadQuestions(selectedPack);
    }
  }, [selectedPack, loadQuestions]);

  useEffect(() => {
    if (selectedQuestion) {
      loadAnswers(selectedQuestion);
    }
  }, [selectedQuestion, loadAnswers]);

  async function runRpc(
    name: string,
    args: Record<string, string | number>
  ) {
    setError("");
    setWorking(true);

    const { error } = await supabase.rpc(name, args);

    if (error) {
      setError(error.message);
      setWorking(false);
      return false;
    }

    await loadGame();
    setWorking(false);
    return true;
  }

  async function startRound() {
    if (!selectedQuestion) {
      setError("Choose a question first.");
      return;
    }

    setError("");
    setWorking(true);

    const { error } = await supabase.rpc("host_start_round", {
      p_game_id: id,
      p_question_id: selectedQuestion,
      p_multiplier: game?.round_multiplier ?? 1,
    });

    if (error) {
      setError(error.message);
      setWorking(false);
      return;
    }

    await loadGame();
    await loadAnswers(selectedQuestion);
    setWorking(false);
  }

  async function revealQuestion() {
  await runRpc("host_reveal_question", {
    p_game_id: id,
  });
}

async function revealAnswer(position: number) {
    const success = await runRpc("host_reveal_answer", {
      p_game_id: id,
      p_answer_position: position,
    });

    if (success) {
      setAnswers((current) =>
        current.map((answer) =>
          answer.answer_position === position
            ? { ...answer, is_revealed: true }
            : answer
        )
      );
    }
  }

  async function openBuzzer() {
    await runRpc("host_open_buzzer", {
      p_game_id: id,
    });
  }

  async function closeBuzzer() {
    await runRpc("host_close_buzzer", {
      p_game_id: id,
    });
  }

  async function resetBuzzers() {
    const success = await runRpc("host_reset_buzzers", {
      p_game_id: id,
    });

    if (success) {
      setBuzzes([]);
    }
  }

  async function addStrike() {
    await runRpc("host_add_strike", {
      p_game_id: id,
    });
  }

  async function clearStrikes() {
    await runRpc("host_clear_strikes", {
      p_game_id: id,
    });
  }

  async function setActiveTeam(team: number) {
    await runRpc("host_set_active_team", {
      p_game_id: id,
      p_team: team,
    });
  }

  async function awardBank(team: number) {
    await runRpc("host_award_bank", {
      p_game_id: id,
      p_team: team,
    });
  }

  async function adjustScore(team: number, amount: number) {
    await runRpc("host_adjust_score", {
      p_game_id: id,
      p_team: team,
      p_amount: amount,
    });
  }

  async function nextRound() {
    const success = await runRpc("host_next_round", {
      p_game_id: id,
    });

    if (success) {
      setAnswers([]);
      setBuzzes([]);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <main className="control-shell">
        <div className="loading">LOADING BALD BOY FEUD...</div>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="control-shell">
        <div className="error-box">{error || "Game not found."}</div>
      </main>
    );
  }

  return (
    <main className="control-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">HOST CONTROL CENTER</div>
          <h1>BALD BOY FEUD</h1>
        </div>

        <div className="room-card">
          <span>ROOM CODE</span>
          <strong>{game.room_code}</strong>
        </div>

        <button className="small-button" onClick={signOut}>
          SIGN OUT
        </button>
      </header>

      {error && <div className="error-box">{error}</div>}

      <section className="scoreboard">
        <div
          className={`team-panel ${
            game.active_team === 1 ? "active-team" : ""
          }`}
        >
          <span>TEAM 1</span>
          <h2>{game.team_one_name}</h2>
          <strong>{game.team_one_score}</strong>

          <div className="mini-buttons">
            <button onClick={() => adjustScore(1, 10)}>+10</button>
            <button onClick={() => adjustScore(1, -10)}>-10</button>
          </div>

          <button
            className="gold-button"
            onClick={() => setActiveTeam(1)}
          >
            MAKE ACTIVE
          </button>
        </div>

        <div className="bank-panel">
          <span>ROUND {game.current_round}</span>
          <h3>ROUND BANK</h3>
          <strong>{game.round_bank}</strong>
          <div className="multiplier">
            {game.round_multiplier}X ROUND
          </div>
        </div>

        <div
          className={`team-panel ${
            game.active_team === 2 ? "active-team" : ""
          }`}
        >
          <span>TEAM 2</span>
          <h2>{game.team_two_name}</h2>
          <strong>{game.team_two_score}</strong>

          <div className="mini-buttons">
            <button onClick={() => adjustScore(2, 10)}>+10</button>
            <button onClick={() => adjustScore(2, -10)}>-10</button>
          </div>

          <button
            className="gold-button"
            onClick={() => setActiveTeam(2)}
          >
            MAKE ACTIVE
          </button>
        </div>
      </section>

      <section className="control-grid">
        <div className="panel question-panel">
          <div className="panel-title">QUESTION CONTROL</div>

          {packs.length === 0 ? (
            <div className="empty-message">
              No question packs found yet. We&apos;ll add your Bald Boy Feud
              questions next.
            </div>
          ) : (
            <>
              <label>QUESTION PACK</label>

              <select
                value={selectedPack}
                onChange={(event) => setSelectedPack(event.target.value)}
              >
                {packs.map((pack) => (
                  <option key={pack.pack_id} value={pack.pack_id}>
                    {pack.pack_name}
                  </option>
                ))}
              </select>

              <label>QUESTION</label>

              <select
                value={selectedQuestion}
                onChange={(event) =>
                  setSelectedQuestion(event.target.value)
                }
              >
                {questions.map((question) => (
                  <option
                    key={question.question_id}
                    value={question.question_id}
                  >
                    {question.question_text}
                  </option>
                ))}
              </select>

              <button
                className="big-gold-button"
                onClick={startRound}
                disabled={working || !selectedQuestion}
              >
                LOAD / START QUESTION
              </button>

              <button
                className="big-gold-button"
                type="button"
                onClick={revealQuestion}
                disabled={working}
              >
                REVEAL QUESTION
              </button>
            </>
          )}

          <div className="answer-sheet">
            {answers.length === 0 ? (
              <div className="empty-answer">
                ANSWERS WILL APPEAR HERE
              </div>
            ) : (
              answers.map((answer) => (
                <div
                  className={`answer-row ${
                    answer.is_revealed ? "revealed" : ""
                  }`}
                  key={answer.answer_position}
                >
                  <div className="answer-number">
                    {answer.answer_position}
                  </div>

                  <div className="answer-text">
                    {answer.answer_text}
                  </div>

                  <div className="answer-points">
                    {answer.answer_points}
                  </div>

                  <button
                    onClick={() =>
                      revealAnswer(answer.answer_position)
                    }
                    disabled={working || answer.is_revealed}
                  >
                    {answer.is_revealed ? "REVEALED" : "REVEAL"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="right-column">
          <div className="panel">
            <div className="panel-title">STRIKES</div>

            <div className="strikes">
              {[1, 2, 3].map((strike) => (
                <div
                  className={
                    game.strikes >= strike
                      ? "strike active-strike"
                      : "strike"
                  }
                  key={strike}
                >
                  X
                </div>
              ))}
            </div>

            <div className="two-buttons">
              <button
                className="red-button"
                onClick={addStrike}
                disabled={working}
              >
                + STRIKE
              </button>

              <button
                className="dark-button"
                onClick={clearStrikes}
                disabled={working}
              >
                CLEAR
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">BUZZER</div>

            <div
              className={
                game.buzzer_open
                  ? "buzzer-status open"
                  : "buzzer-status"
              }
            >
              {game.buzzer_open ? "BUZZER OPEN" : "BUZZER CLOSED"}
            </div>

            <div className="two-buttons">
              <button
                className="green-button"
                onClick={openBuzzer}
                disabled={working}
              >
                OPEN
              </button>

              <button
                className="red-button"
                onClick={closeBuzzer}
                disabled={working}
              >
                CLOSE
              </button>
            </div>

            <button
              className="dark-button full"
              onClick={resetBuzzers}
              disabled={working}
            >
              RESET BUZZERS
            </button>

            <div className="buzz-list">
              <h4>BUZZ ORDER</h4>

              {buzzes.length === 0 ? (
                <p>No buzzes yet.</p>
              ) : (
                buzzes.map((buzz, index) => (
                  <div
                    className="buzz-row"
                    key={`${buzz.player_name}-${buzz.buzz_time}`}
                  >
                    <strong>#{index + 1}</strong>

                    <span>{buzz.player_name}</span>

                    <small>
                      {buzz.player_team === 1
                        ? game.team_one_name
                        : game.team_two_name}
                    </small>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">ROUND CONTROL</div>

            <button
              className="team-award team-one-award"
              onClick={() => awardBank(1)}
              disabled={working}
            >
              AWARD BANK TO {game.team_one_name.toUpperCase()}
            </button>

            <button
              className="team-award team-two-award"
              onClick={() => awardBank(2)}
              disabled={working}
            >
              AWARD BANK TO {game.team_two_name.toUpperCase()}
            </button>

            <button
              className="big-gold-button"
              onClick={nextRound}
              disabled={working}
            >
              NEXT ROUND →
            </button>
          </div>
        </div>
      </section>

      <footer>
        <span>GAME ID: {game.id}</span>
        <span>STATUS: {game.status.toUpperCase()}</span>
      </footer>

      <style jsx>{`
        .control-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at top, #174f9b 0%, #082b63 38%, #03162f 100%);
          color: white;
          padding: 28px;
          font-family: Arial, Helvetica, sans-serif;
        }

        .topbar {
          max-width: 1450px;
          margin: auto;
          display: grid;
          grid-template-columns: 1fr auto auto;
          align-items: center;
          gap: 25px;
          border-bottom: 2px solid #f6c33b;
          padding-bottom: 20px;
        }

        .eyebrow,
        .panel-title,
        label {
          color: #ffd34e;
          font-weight: 900;
          letter-spacing: 2px;
        }

        h1 {
          margin: 4px 0 0;
          font-size: clamp(28px, 4vw, 52px);
          letter-spacing: 2px;
        }

        .room-card {
          background: #061d42;
          border: 3px solid #ffd34e;
          border-radius: 14px;
          padding: 10px 24px;
          text-align: center;
        }

        .room-card span {
          display: block;
          color: #9fcaff;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .room-card strong {
          color: #ffd34e;
          font-size: 30px;
          letter-spacing: 5px;
        }

        button,
        select {
          font: inherit;
        }

        button {
          cursor: pointer;
          font-weight: 900;
          letter-spacing: 0.5px;
        }

        button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .small-button,
        .dark-button {
          color: white;
          background: #0c3268;
          border: 1px solid #477db9;
          border-radius: 9px;
          padding: 12px 16px;
        }

        .scoreboard {
          max-width: 1450px;
          margin: 25px auto;
          display: grid;
          grid-template-columns: 1fr 0.7fr 1fr;
          gap: 16px;
        }

        .team-panel,
        .bank-panel {
          background: rgba(5, 31, 70, 0.92);
          border: 2px solid #285b98;
          border-radius: 18px;
          padding: 22px;
          text-align: center;
        }

        .team-panel.active-team {
          border-color: #ffd34e;
          box-shadow: 0 0 25px rgba(255, 211, 78, 0.3);
        }

        .team-panel > span,
        .bank-panel > span {
          color: #9fcaff;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .team-panel h2 {
          margin: 8px 0;
          font-size: 24px;
        }

        .team-panel > strong,
        .bank-panel > strong {
          display: block;
          color: #ffd34e;
          font-size: 54px;
        }

        .bank-panel h3 {
          margin: 8px 0 0;
        }

        .multiplier {
          margin-top: 6px;
          color: #9fcaff;
          font-weight: 900;
        }

        .mini-buttons,
        .two-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 12px;
        }

        .mini-buttons button {
          padding: 8px;
          border-radius: 8px;
          border: 1px solid #477db9;
          background: #0d3c79;
          color: white;
        }

        .gold-button,
        .big-gold-button {
          background: linear-gradient(#ffe37c, #f4b91d);
          color: #061d42;
          border: 0;
          border-radius: 10px;
          padding: 12px 16px;
        }

        .gold-button {
          margin-top: 10px;
          width: 100%;
        }

        .big-gold-button {
          width: 100%;
          margin-top: 14px;
          padding: 15px;
        }

        .control-grid {
          max-width: 1450px;
          margin: auto;
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(330px, 0.8fr);
          gap: 18px;
        }

        .right-column {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .panel {
          background: rgba(4, 25, 57, 0.94);
          border: 1px solid #285b98;
          border-radius: 18px;
          padding: 20px;
          box-shadow: 0 14px 35px rgba(0, 0, 0, 0.18);
        }

        .panel-title {
          margin-bottom: 18px;
        }

        label {
          display: block;
          font-size: 11px;
          margin: 14px 0 7px;
        }

        select {
          width: 100%;
          background: #fff6d8;
          color: #071a36;
          border: 3px solid #5277a5;
          border-radius: 10px;
          padding: 13px;
          font-weight: 800;
        }

        .answer-sheet {
          margin-top: 22px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .answer-row {
          display: grid;
          grid-template-columns: 45px 1fr 65px 110px;
          gap: 8px;
          align-items: center;
          background: #104486;
          border: 2px solid #2d6eb3;
          padding: 8px;
          border-radius: 9px;
        }

        .answer-row.revealed {
          border-color: #ffd34e;
          background: #755512;
        }

        .answer-number {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #ffd34e;
          color: #071a36;
          font-weight: 1000;
        }

        .answer-text {
          font-size: 18px;
          font-weight: 900;
        }

        .answer-points {
          text-align: center;
          color: #ffd34e;
          font-size: 22px;
          font-weight: 1000;
        }

        .answer-row button {
          background: #fff2b7;
          color: #071a36;
          border: 0;
          border-radius: 7px;
          padding: 10px;
        }

        .empty-answer,
        .empty-message {
          color: #9fcaff;
          text-align: center;
          border: 1px dashed #477db9;
          border-radius: 10px;
          padding: 25px;
        }

        .strikes {
          display: flex;
          justify-content: center;
          gap: 14px;
          margin: 10px 0 18px;
        }

        .strike {
          width: 70px;
          height: 70px;
          display: grid;
          place-items: center;
          border: 3px solid #354d6d;
          border-radius: 12px;
          color: #354d6d;
          font-size: 48px;
          font-weight: 1000;
        }

        .active-strike {
          color: #ff3030;
          border-color: #ff3030;
          text-shadow: 0 0 15px #ff3030;
          box-shadow: 0 0 20px rgba(255, 48, 48, 0.2);
        }

        .red-button,
        .green-button {
          border: 0;
          border-radius: 9px;
          padding: 13px;
          color: white;
        }

        .red-button {
          background: #b51f32;
        }

        .green-button {
          background: #087e55;
        }

        .full {
          width: 100%;
          margin-top: 8px;
        }

        .buzzer-status {
          padding: 18px;
          text-align: center;
          background: #321525;
          border: 2px solid #9d324a;
          color: #ff8090;
          border-radius: 10px;
          font-weight: 1000;
          letter-spacing: 2px;
        }

        .buzzer-status.open {
          background: #083e31;
          border-color: #18c689;
          color: #64f0bd;
        }

        .buzz-list {
          margin-top: 18px;
        }

        .buzz-list h4 {
          color: #9fcaff;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }

        .buzz-list p {
          color: #7fa3cf;
        }

        .buzz-row {
          display: grid;
          grid-template-columns: 40px 1fr auto;
          align-items: center;
          padding: 9px;
          border-bottom: 1px solid #234d7c;
        }

        .buzz-row strong {
          color: #ffd34e;
        }

        .buzz-row small {
          color: #9fcaff;
        }

        .team-award {
          width: 100%;
          padding: 13px;
          border-radius: 9px;
          margin-bottom: 9px;
          border: 1px solid #477db9;
          color: white;
          background: #0d3c79;
        }

        .error-box {
          max-width: 1450px;
          margin: 15px auto;
          padding: 13px;
          background: #421626;
          border: 1px solid #d9465f;
          color: #ffb5bf;
          border-radius: 10px;
        }

        .loading {
          text-align: center;
          color: #ffd34e;
          font-size: 25px;
          font-weight: 1000;
          padding-top: 20vh;
        }

        footer {
          max-width: 1450px;
          margin: 25px auto;
          color: #7398c5;
          font-size: 11px;
          display: flex;
          justify-content: space-between;
        }

        @media (max-width: 900px) {
          .topbar {
            grid-template-columns: 1fr;
          }

          .scoreboard,
          .control-grid {
            grid-template-columns: 1fr;
          }

          .answer-row {
            grid-template-columns: 40px 1fr 50px;
          }

          .answer-row button {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </main>
  );
}