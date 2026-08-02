'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SlidersHorizontal,
  ToggleRight,
  Trophy,
  Scale,
  GitBranch,
  Eye,
  ShieldPlus,
  Check,
  Plus,
  Trash2,
  AlertTriangle,
  Lock,
  Users,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { MODULES } from '@/lib/modules';
import { CAPABILITIES, useSettings, useSettingsState } from '@/lib/settings';

/**
 * Module 16 — Configurable Settings Engine (Superadmin).
 *
 * Six panels of governed controls. Everything reads and writes through the
 * authenticated admin settings API via useSettings, with an explicit visible
 * fallback state if the server load/save fails; the shared "Saved" pill flashes
 * only after the server accepts a change.
 */

const XP_ACTIONS = [
  { id: 'WORKSHOP', label: 'Workshop attendance' },
  { id: 'COURSE', label: 'Course completion' },
  { id: 'FYP', label: 'FYP submission' },
  { id: 'LOGBOOK', label: 'On-time logbook entry' },
  { id: 'DIAGNOSTIC', label: 'Diagnostic passed' },
];

const LEADERBOARD_MODES = [
  { id: 'off', label: 'Off' },
  { id: 'optin', label: 'Opt-in' },
  { id: 'on', label: 'On' },
];

const APPROVAL_ITEMS = [
  { id: 'fyp', label: 'FYP submissions' },
  { id: 'course', label: 'Course completions' },
  { id: 'logbook', label: 'Logbook hours' },
];

const VISIBILITY_ITEMS = [
  { id: 'resume', label: 'Resume / CV' },
  { id: 'fyp', label: 'FYP showcase' },
  { id: 'logbook', label: 'Logbook' },
];

const VISIBILITY_MODES = [
  { id: 'public', label: 'Public', icon: Globe },
  { id: 'optin', label: 'Opt-in', icon: Users },
  { id: 'private', label: 'Private', icon: Lock },
];

const WEIGHT_KEYS = [
  { id: 'faculty', label: 'Faculty' },
  { id: 'programme', label: 'Programme' },
  { id: 'year', label: 'Year of study' },
  { id: 'interest', label: 'Declared interest' },
];

const TABS = [
  { id: 'features', label: 'Feature Toggles', icon: ToggleRight },
  { id: 'gamification', label: 'Gamification', icon: Trophy },
  { id: 'matching', label: 'Match Weighting', icon: Scale },
  { id: 'approvals', label: 'Approvals', icon: GitBranch },
  { id: 'visibility', label: 'Visibility', icon: Eye },
  { id: 'roles', label: 'Permission Sets', icon: ShieldPlus },
];

/** Small toggle switch, on-brand (crimson when on). */
function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-crimson' : 'bg-black/[0.12]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/** Segmented control for a small fixed set of options. */
function Segmented({ value, options, onChange, name }) {
  return (
    <div className="inline-flex rounded-xl border border-black/10 bg-black/[0.03] p-1" role="group" aria-label={name}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              active ? 'bg-white text-crimson shadow-sm' : 'text-[#424245] hover:text-[#1d1d1f]'
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsEngine() {
  const [settings, updateSettings] = useSettings();
  const {
    loading,
    saving,
    error,
    conflict,
    source,
    reloadSettings,
  } = useSettingsState();
  const [tab, setTab] = useState('features');

  // Shared "Saved" confirmation. Any panel calls save() after patching; the
  // pill fades back out on a timer. A ref holds the timeout so rapid edits
  // debounce into a single lingering confirmation rather than flickering.
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);
  const flashSaved = () => {
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1600);
  };
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  // Wrap updateSettings so every mutation also flashes the confirmation.
  const patch = async (fn) => {
    try {
      await updateSettings(fn);
      flashSaved();
      return true;
    } catch {
      return false;
    }
  };

  const weightSum = useMemo(
    () => WEIGHT_KEYS.reduce((sum, k) => sum + (Number(settings.matchWeights[k.id]) || 0), 0),
    [settings.matchWeights],
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-black/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h2 className="section-title font-heading flex items-center gap-2.5 text-[#1d1d1f]">
            <SlidersHorizontal className="h-5 w-5 text-crimson" />
            <span>Configurable Settings Engine</span>
          </h2>
          <p className="section-subtitle max-w-2xl">
            The platform&apos;s control surface — feature flags, XP rules, match weighting,
            approvals, visibility and custom permission sets. Changes save only after the server accepts them.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            aria-live="polite"
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-opacity duration-300 ${
              saved
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 opacity-100'
                : 'border-transparent bg-transparent text-transparent opacity-0'
            }`}
          >
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
          <span className="flex items-center gap-1.5 rounded-xl border border-crimson/30 bg-crimson/10 px-3.5 py-2 text-xs font-semibold text-red-600">
            <ShieldPlus className="h-4 w-4" /> Superadmin
          </span>
        </div>
      </div>

      {(loading || saving || error || conflict || source === 'fallback') && (
        <div
          aria-live="polite"
          className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
            error || conflict || source === 'fallback'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-black/10 bg-white text-[#1d1d1f]'
          }`}
        >
          <div className="space-y-1">
            {loading && <p className="font-semibold">Loading governed settings from the server…</p>}
            {saving && <p className="font-semibold">Saving changes…</p>}
            {conflict && <p className="font-semibold">{conflict}</p>}
            {!conflict && error && <p className="font-semibold">{error}</p>}
            {source === 'fallback' && !loading && (
              <p className="text-xs text-amber-800">
                Showing the built-in fallback only. Changes will not be confirmed until the server responds.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void reloadSettings()}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[#1d1d1f] transition hover:border-black/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                active
                  ? 'border-crimson/30 bg-crimson/[0.06] text-crimson'
                  : 'border-black/10 bg-white text-[#424245] hover:border-black/20 hover:text-[#1d1d1f]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ---------------- Feature Toggles ---------------- */}
      {tab === 'features' && (
        <section className="glass-panel space-y-1 p-6">
          <h3 className="font-heading text-lg font-bold text-[#1d1d1f]">Feature Toggles</h3>
          <p className="text-sm text-muted">
            Enable or retire a module platform-wide. Disabling hides it from every role&apos;s
            navigation without deleting the route.
          </p>
          <div className="mt-4 divide-y divide-black/10">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              const on = settings.featureToggles[mod.id] ?? true;
              return (
                <div key={mod.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-black/[0.04] p-2 text-crimson">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#1d1d1f]">{mod.longLabel}</p>
                      <p className="text-xs text-muted">{mod.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge-pill border ${on ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-black/[0.04] text-[#6e6e73] border-black/10'}`}>
                      {on ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={on}
                      label={`Toggle ${mod.longLabel}`}
                      onChange={(next) =>
                        void patch((s) => ({
                          ...s,
                          featureToggles: { ...s.featureToggles, [mod.id]: next },
                        }))
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------------- Gamification ---------------- */}
      {tab === 'gamification' && (
        <section className="space-y-6">
          <div className="glass-panel space-y-1 p-6">
            <h3 className="font-heading text-lg font-bold text-[#1d1d1f]">XP Values</h3>
            <p className="text-sm text-muted">Points awarded for each career action.</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {XP_ACTIONS.map((action) => (
                <label key={action.id} className="surface flex items-center justify-between gap-3 p-4">
                  <span className="text-sm font-medium text-[#1d1d1f]">{action.label}</span>
                  <span className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={settings.gamification.xpValues[action.id] ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        void patch((s) => ({
                          ...s,
                          gamification: {
                            ...s.gamification,
                            xpValues: { ...s.gamification.xpValues, [action.id]: val },
                          },
                        }));
                      }}
                      className="w-20 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-right text-sm font-semibold text-[#1d1d1f] tabular-nums outline-none focus:border-crimson/40"
                    />
                    <span className="text-xs font-semibold text-muted">XP</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="glass-panel space-y-1 p-6">
            <h3 className="font-heading text-lg font-bold text-[#1d1d1f]">Leaderboard</h3>
            <p className="text-sm text-muted">
              Off hides all rankings; Opt-in shows only students who choose to appear; On ranks
              everyone.
            </p>
            <div className="mt-4">
              <Segmented
                name="Leaderboard mode"
                value={settings.gamification.leaderboard}
                options={LEADERBOARD_MODES}
                onChange={(mode) =>
                    void patch((s) => ({
                      ...s,
                      gamification: { ...s.gamification, leaderboard: mode },
                    }))
                }
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {settings.gamification.tiers.map((tier) => (
                <span
                  key={tier.name}
                  className="badge-pill border border-black/10 bg-black/[0.03] text-[#424245]"
                >
                  {tier.name}
                  <span className="ml-1 text-muted tabular-nums">· {tier.min.toLocaleString()}+</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Match Weighting ---------------- */}
      {tab === 'matching' && (
        <section className="glass-panel space-y-5 p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-heading text-lg font-bold text-[#1d1d1f]">Match-Score Weighting</h3>
              <p className="text-sm text-muted">
                How the opportunity matcher scores a student against a role. Weights are a
                percentage split.
              </p>
            </div>
            <span
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold tabular-nums ${
                Math.abs(weightSum - 100) <= 1
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {Math.abs(weightSum - 100) > 1 && <AlertTriangle className="h-4 w-4" />}
              Total: {weightSum}%
            </span>
          </div>

          <div className="space-y-5">
            {WEIGHT_KEYS.map((k) => {
              const val = Number(settings.matchWeights[k.id]) || 0;
              return (
                <div key={k.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[#1d1d1f]">{k.label}</span>
                    <span className="font-bold text-crimson tabular-nums">{val}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={val}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      void patch((s) => ({
                        ...s,
                        matchWeights: { ...s.matchWeights, [k.id]: next },
                      }));
                    }}
                    aria-label={`${k.label} weight`}
                    className="w-full accent-crimson"
                  />
                </div>
              );
            })}
          </div>

          {Math.abs(weightSum - 100) > 1 && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Weights should total 100% for a balanced match score. Currently {weightSum}%.
            </p>
          )}
        </section>
      )}

      {/* ---------------- Approvals ---------------- */}
      {tab === 'approvals' && (
        <section className="glass-panel space-y-1 p-6">
          <h3 className="font-heading text-lg font-bold text-[#1d1d1f]">Approval Workflows</h3>
          <p className="text-sm text-muted">
            Auto clears a submission on the spot; Manual routes it to a human for sign-off.
          </p>
          <div className="mt-4 space-y-3">
            {APPROVAL_ITEMS.map((item) => (
              <div
                key={item.id}
                className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm font-semibold text-[#1d1d1f]">{item.label}</span>
                <Segmented
                  name={`${item.label} approval`}
                  value={settings.approvals[item.id]}
                  options={[
                    { id: 'auto', label: 'Auto-approve' },
                    { id: 'manual', label: 'Manual review' },
                  ]}
                  onChange={(mode) =>
                    void patch((s) => ({ ...s, approvals: { ...s.approvals, [item.id]: mode } }))
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Visibility ---------------- */}
      {tab === 'visibility' && (
        <section className="glass-panel space-y-1 p-6">
          <h3 className="font-heading text-lg font-bold text-[#1d1d1f]">Visibility Rules</h3>
          <p className="text-sm text-muted">
            The default audience for student-owned records. Students may still tighten their own.
          </p>
          <div className="mt-4 space-y-3">
            {VISIBILITY_ITEMS.map((item) => (
              <div
                key={item.id}
                className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm font-semibold text-[#1d1d1f]">{item.label}</span>
                <Segmented
                  name={`${item.label} visibility`}
                  value={settings.visibility[item.id]}
                  options={VISIBILITY_MODES}
                  onChange={(mode) =>
                    void patch((s) => ({ ...s, visibility: { ...s.visibility, [item.id]: mode } }))
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Custom Permission Sets ---------------- */}
      {tab === 'roles' && (
        <RolesPanel settings={settings} patch={patch} />
      )}
    </div>
  );
}

/**
 * Custom permission sets. Kept in its own component so the draft-role form state
 * (name + ticked capabilities) is local and does not re-render the whole engine
 * on every keystroke.
 */
function RolesPanel({ settings, patch }) {
  const [name, setName] = useState('');
  const [caps, setCaps] = useState([]);

  const toggleCap = (id) =>
    setCaps((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const canAdd = name.trim().length > 0 && caps.length > 0;

  const addRole = () => {
    if (!canAdd) return;
    const role = { name: name.trim(), capabilities: caps };
    void patch((s) => ({ ...s, customRoles: [...s.customRoles, role] }));
    setName('');
    setCaps([]);
  };

  const removeRole = (index) =>
    void patch((s) => ({ ...s, customRoles: s.customRoles.filter((_, i) => i !== index) }));

  const labelFor = (id) => CAPABILITIES.find((c) => c.id === id)?.label ?? id;

  return (
    <section className="space-y-6">
      {/* Builder */}
      <div className="glass-panel space-y-4 p-6">
        <div>
          <h3 className="font-heading text-lg font-bold text-[#1d1d1f]">Custom Permission Sets</h3>
          <p className="text-sm text-muted">
            Compose a named role from individual capabilities, then reuse it when inviting staff.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="role-name" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Role name
          </label>
          <input
            id="role-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Faculty Coordinator"
            className="w-full max-w-sm rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-[#1d1d1f] outline-none focus:border-crimson/40"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Capabilities</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {CAPABILITIES.map((cap) => {
              const on = caps.includes(cap.id);
              return (
                <button
                  key={cap.id}
                  type="button"
                  onClick={() => toggleCap(cap.id)}
                  aria-pressed={on}
                  className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition ${
                    on
                      ? 'border-crimson/30 bg-crimson/[0.06] text-[#1d1d1f]'
                      : 'border-black/10 bg-white text-[#424245] hover:border-black/20'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      on ? 'border-crimson bg-crimson text-white' : 'border-black/20 bg-white'
                    }`}
                  >
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  {cap.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={addRole}
          disabled={!canAdd}
          className="crimson-btn disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> Add permission set
        </button>
      </div>

      {/* Existing roles */}
      <div className="glass-panel space-y-4 p-6">
        <h3 className="font-heading text-base font-bold text-[#1d1d1f]">
          Defined roles
          <span className="ml-2 text-sm font-semibold text-muted">
            ({settings.customRoles.length})
          </span>
        </h3>
        {settings.customRoles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 bg-black/[0.02] p-6 text-center text-sm text-muted">
            No custom roles yet. Build one above.
          </p>
        ) : (
          <div className="space-y-3">
            {settings.customRoles.map((role, index) => (
              <div key={`${role.name}-${index}`} className="surface flex items-start justify-between gap-4 p-4">
                <div className="space-y-2">
                  <p className="text-sm font-bold text-[#1d1d1f]">{role.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {role.capabilities.map((capId) => (
                      <span
                        key={capId}
                        className="badge-pill border border-crimson/20 bg-crimson/[0.06] text-red-600"
                      >
                        {labelFor(capId)}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRole(index)}
                  aria-label={`Delete ${role.name}`}
                  className="rounded-lg border border-black/10 bg-white p-2 text-[#6e6e73] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
