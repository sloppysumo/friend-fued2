"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HostPage() {
  const router = useRouter();

  const [teamOne, setTeamOne] = useState("Team One");
  const [teamTwo, setTeamTwo] = useState("Team Two");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkLogin() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setLoading(false);
    }

    checkLogin();
  }, [router]);

  async function createGame() {
    setCreating(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data, error: createError } = await supabase.rpc(
        "create_friend_feud_game",
        {
          p_team_one_name: teamOne.trim() || "Team One",
          p_team_two_name: teamTwo.trim() || "Team Two",
        }
      );

      if (createError) {
        throw createError;
      }

      if (!data || data.length === 0) {
        throw new Error(
          "The game was created, but no game ID was returned."
        );
      }

      const gameId = data[0].game_id;

      if (!gameId) {
        throw new Error("No game ID was returned by Supabase.");
      }

      router.push(`/host/game/${gameId}`);
    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong while creating the game.");
      }

      setCreating(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <main className="host-page">
        <div className="host-loading">
          LOADING BALD BOY FEUD...
        </div>
      </main>
    );
  }

  return (
    <main className="host-page">
      <section className="host-shell">
        <header className="host-topbar">
          <div>
            <p className="host-eyebrow">
              BALD BOY FEUD
            </p>

            <h1>HOST DASHBOARD</h1>

            <p className="host-subtitle">
              Create a game, invite your friends, and control the show.
            </p>
          </div>

          <button
            className="host-signout"
            onClick={signOut}
          >
            SIGN OUT
          </button>
        </header>

        <section className="create-game-card">
          <div className="create-game-heading">
            <span>NEW GAME</span>

            <h2>SET UP YOUR TEAMS</h2>

            <p>
              Give both teams a name. You can change these for every game.
            </p>
          </div>

          <div className="team-input-grid">
            <label className="team-input-card">
              <span>TEAM 1</span>

              <input
                type="text"
                value={teamOne}
                maxLength={30}
                onChange={(event) =>
                  setTeamOne(event.target.value)
                }
                placeholder="Team One"
              />
            </label>

            <div className="versus-circle">
              VS
            </div>

            <label className="team-input-card">
              <span>TEAM 2</span>

              <input
                type="text"
                value={teamTwo}
                maxLength={30}
                onChange={(event) =>
                  setTeamTwo(event.target.value)
                }
                placeholder="Team Two"
              />
            </label>
          </div>

          {error && (
            <div className="host-error">
              {error}
            </div>
          )}

          <button
            className="create-game-button"
            onClick={createGame}
            disabled={creating}
          >
            {creating
              ? "CREATING GAME..."
              : "CREATE GAME"}
          </button>
        </section>

        <section className="host-info-grid">
          <div className="host-info-card">
            <span>1</span>

            <h3>CREATE</h3>

            <p>
              Create your game and get a room code.
            </p>
          </div>

          <div className="host-info-card">
            <span>2</span>

            <h3>INVITE</h3>

            <p>
              Friends join from their phones.
            </p>
          </div>

          <div className="host-info-card">
            <span>3</span>

            <h3>PLAY</h3>

            <p>
              You control the board, scores, strikes, and buzzers.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}