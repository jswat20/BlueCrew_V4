-- Repair assignments reopened before approved-claim withdrawal was added.
-- These rows cannot represent a current approval because no crew member remains assigned.

update public.assignment_claims claim
set status = 'withdrawn',
    decided_at = now(),
    decision_reason = 'Administrative assignment removal (historical repair)',
    updated_at = now()
from public.game_assignments assignment
where assignment.organization_id = claim.organization_id
  and assignment.id = claim.assignment_id
  and assignment.status = 'needs_assignment'
  and assignment.assigned_crew_member_id is null
  and not assignment.locked
  and claim.status = 'approved'
  and claim.decision_by_profile_id is not null;
