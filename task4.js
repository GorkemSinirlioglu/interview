import React, { useEffect, useState, useRef } from "react";

// NOTE: API contract (assume exists):
// GET https://api.example.com/users?q=<query>&page=<n>&sort=<name|created>&dir=<asc|desc>
// -> { items: Array<{ id, name, email, createdAt }>, nextPage: number|null }

export default function LegacyUsers() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);          // replaced wholesale each time
  const [page, setPage] = useState(1);             // page starts at 1
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [sort, setSort] = useState("name");        // or "created"
  const [dir, setDir] = useState("asc");           // or "desc"
  const [nextPage, setNextPage] = useState(null);
  const staleQueryRef = useRef(q);                 // used incorrectly for “stale” detection
  const inputRef = useRef(null);
  const cacheRef = useRef({});                     // naive cache by `${q}|${page}|${sort}|${dir}`
  const mounted = useRef(false);
  let controller = useRef(null);                   // reused incorrectly

  // focus search on mount (sometimes causes scroll jumps)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, []);

  // Fetch whenever anything changes — but this is buggy:
  // - No debounce -> floods API
  // - Reuses AbortController across calls improperly (leaks)
  // - Race conditions: late responses overwrite newer ones
  // - Cache never expires, grows unbounded
  // - Errors swallowed/overwritten
  useEffect(() => {
    let isActive = true;
    setLoading(true);
    setErr(null);

    const key = `${q}|${page}|${sort}|${dir}`;

    if (cacheRef.current[key]) {
      // pretend cache is always valid
      setUsers(cacheRef.current[key].items);
      setNextPage(cacheRef.current[key].nextPage);
      setLoading(false);
      return; // doesn’t set isActive=false or handle races
    }

    if (!controller.current) {
      controller.current = new AbortController();
    } else {
      // abort previous *and keep using the same controller* (anti-pattern)
      try { controller.current.abort(); } catch {}
    }

    // resetting the same controller to a new one after aborting (still shared)
    controller.current = new AbortController();

    const url = `https://api.example.com/users?q=${encodeURIComponent(q)}&page=${page}&sort=${sort}&dir=${dir}`;

    fetch(url, { signal: controller.current.signal })
      .then(r => {
        if (!r.ok) throw new Error("Bad status " + r.status);
        return r.json();
      })
      .then(data => {
        if (!isActive) return;
        // late response can overwrite newer state (no query/version check)
        staleQueryRef.current = q; // meaningless write
        setUsers(data.items || []);
        setNextPage(data.nextPage ?? null);
        cacheRef.current[key] = { items: data.items || [], nextPage: data.nextPage ?? null };
      })
      .catch(e => {
        if (!isActive) return;
        if (e.name !== "AbortError") {
          setErr(e);
        }
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });

    // cleanup
    return () => {
      isActive = false;
      // doesn’t abort here (leaks fetch when unmounted during pending)
    };
  }, [q, page, sort, dir]);

  // naive sorting toggler (re-renders too often)
  function toggleSort(next) {
    if (next === sort) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setSort(next);
      setDir("asc");
    }
    setPage(1);
  }

  // naive infinite “load more”
  function loadMore() {
    if (!nextPage) return;
    setPage(nextPage);
  }

  // uncontrolled input and no a11y labels
  return (
    <div style={{ padding: 12 }}>
      <h2>Users</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          ref={inputRef}
          placeholder="Search"
          defaultValue={q} // uncontrolled + state (buggy)
          onChange={(e) => {
            setQ(e.target.value); // no debounce; resets page sometimes too late
            if (page !== 1) setPage(1);
          }}
        />
        <button onClick={() => toggleSort("name")}>
          Sort by name ({sort === "name" ? dir : "asc"})
        </button>
        <button onClick={() => toggleSort("created")}>
          Sort by created ({sort === "created" ? dir : "asc"})
        </button>
      </div>

      {err && <div style={{ color: "red" }}>{String(err)}</div>}
      {loading && <div>Loading...</div>}

      <ul>
        {users.map((u, i) => (
          // key uses index (bad); no semantics; no email link; date raw
          <li key={i} onClick={() => alert(u.email)} style={{ cursor: "pointer" }}>
            <b>{u.name}</b> — {u.email} — {u.createdAt}
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 8 }}>
        <button disabled={!nextPage || loading} onClick={loadMore}>
          {nextPage ? "Load more" : "No more"}
        </button>
      </div>
    </div>
  );
}
