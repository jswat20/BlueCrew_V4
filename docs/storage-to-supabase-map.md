# BlueCrew storage-to-Supabase mapping

| Current key/domain | Supabase destination | Compatibility notes |
|---|---|---|
| `bluecrew_accounts` | `profiles` | Preserve legacy account ID, Crew ID/code, canonical role, approval state, profile/contact fields, and communication preferences. Auth credentials remain in `auth.users`. |
| `bluecrew_session` | Supabase Auth session | Not migrated as business data. Milestone 2B replaces local email-only sessions. |
| `bluecrew-crew-v2` crew records | `crew_members` | Preserve legacy crew IDs, eligibility, preferences, active state, and account linkage. |
| `bluecrew-crew-v2` date availability | `availability` | One row per crew member/date/time window. |
| `bluecrew-games-v2` games | `games` | Preserve legacy game IDs, lifecycle state, review/report payloads, and source metadata. |
| `bluecrew-games-v2` assignment slots | `game_assignments` | One row per game position; preserve assignment status, lock state, and decline details. |
| `bluecrew-games-v2` claim/history data | `assignment_claims` | One row per claim attempt and decision. |
| `bluecrew_games` | `games`, `game_assignments`, `assignment_claims` | Legacy fallback import source only; never a dual-write target. |
| `bluecrew_location_catalog` | `locations`, `fields` | Fields retain an organization-scoped parent location. Legacy unassigned values remain import metadata until resolved. |
| `bluecrew_notifications` | `notifications` | Preserve type, audience, recipient, related ID, destination page/context, read state, and reminder key. |
| `bluecrew_activity` | `activities` | Preserve actor/subject/object/message and arbitrary structured metadata. |
| `bluecrew_report_presets` | `report_presets` | Presets become organization- and owner-scoped. |
| `bluecrewDatabase_v1` | `migration_runs` plus mapped domain tables | Legacy migration marker/source only. |
| Static settings and season context | `organizations`, `seasons` | Organization configuration and active season become shared data. |

Existing keys remain reserved for an explicit, reviewed import tool. After cutover, PostgreSQL is authoritative and there is no local/remote dual-write.
