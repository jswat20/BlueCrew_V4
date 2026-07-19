
// js/services/timelineService.js

const timelineService = (() => {
  function clean(value) {
    return String(value ?? "").trim();
  }

  function pluralize(
    count,
    singular,
    plural = `${singular}s`
  ) {
    return Number(count) === 1
      ? singular
      : plural;
  }

  function getActor(activity) {
    return clean(activity.actor);
  }

  function getObject(activity) {
    return clean(
      activity.object ||
      activity.matchup
    );
  }

  function getSubject(activity) {
    return clean(activity.subject);
  }

  function actorPrefix(activity) {
    const actor =
      getActor(activity);

    return actor
      ? `${actor} `
      : "";
  }

  function objectSuffix(activity) {
    const object =
      getObject(activity);

    return object
      ? ` for ${object}`
      : "";
  }

  function formatAssignmentStory(
    activity
  ) {
    const actor =
      actorPrefix(activity);

    const subject =
      getSubject(activity);

    const object =
      getObject(activity);

    switch (activity.action) {
      case "assigned":
        if (/(assigned to|changed to)/i.test(activity.message || "")) {
          return activity.message;
        }

        if (
          activity.actor &&
          subject &&
          object
        ) {
          return (
            `${actor}was assigned to ` +
            `${subject} for ${object}.`
          );
        }

        if (object) {
          return (
            `Assignment updated for ` +
            `${object}.`
          );
        }

        return (
          activity.message ||
          "An assignment was updated."
        );

      case "cleared":
        return activity.message || (object
          ? `Assignment cleared for ${object}.`
          : "An assignment was cleared.");

      case "opened_for_claim":
        return object
          ? `${object} was opened for claims.`
          : (
              activity.message ||
              "A game was opened for claims."
            );

      case "claim_submitted":
        return (
          `${actor || "An umpire "}` +
          `submitted a claim` +
          objectSuffix(activity) +
          "."
        );

      case "claim_approved":
        return object
          ? `Claim approved for ${object}.`
          : (
              activity.message ||
              "A claim was approved."
            );

      case "claim_rejected":
        return object
          ? `Claim rejected for ${object}.`
          : (
              activity.message ||
              "A claim was rejected."
            );

      default:
        return (
          activity.message ||
          (
            object
              ? `Assignment activity for ${object}.`
              : "Assignment activity recorded."
          )
        );
    }
  }

  function formatAccountStory(
    activity
  ) {
    const actor =
      getActor(activity);

    const subject =
      getSubject(activity) ||
      getObject(activity);

    switch (activity.action) {
      case "account_created":
      case "registered":
        return subject
          ? `${subject} registered for an account.`
          : "A new account was registered.";

      case "account_approved":
      case "approved":
        return subject
          ? `${subject}'s account was approved.`
          : "An account was approved.";

      case "account_rejected":
      case "rejected":
        return subject
          ? `${subject}'s account was rejected.`
          : "An account was rejected.";

      case "role_updated":
        return subject
          ? `${subject}'s account role was updated.`
          : "An account role was updated.";

      default:
        return (
          activity.message ||
          (
            actor
              ? `${actor} updated an account.`
              : "Account activity recorded."
          )
        );
    }
  }

  function formatGameStory(
    activity
  ) {
    const object =
      getObject(activity);

    switch (activity.action) {
      case "game_created":
      case "created":
        return object
          ? `${object} was added to the schedule.`
          : "A game was added to the schedule.";

      case "game_updated":
      case "updated":
        if (Array.isArray(activity.metadata?.changes) && activity.metadata.changes.length) {
          const labels = { date: "Date", time: "Time", field: "Field", venue: "Location", level: "Level", homeTeam: "Home team", awayTeam: "Away team", status: "Status" };
          return activity.metadata.changes.map(change =>
            `${labels[change.field] || change.field}: ${change.from || "Not set"} changed to ${change.to || "Not set"}.`
          ).join(" ");
        }
        return object
          ? `${object} was updated.`
          : "A game was updated.";

      case "game_cancelled":
      case "cancelled":
        return object
          ? `${object} was cancelled.`
          : "A game was cancelled.";

      case "games_imported":
      case "imported": {
        const count =
          Number(activity.count) || 0;

        if (count) {
          return (
            `${count} ` +
            `${pluralize(
              count,
              "game"
            )} were imported into the schedule.`
          );
        }

        return (
          activity.message ||
          "Games were imported into the schedule."
        );
      }

      default:
        return (
          activity.message ||
          (
            object
              ? `Schedule activity for ${object}.`
              : "Schedule activity recorded."
          )
        );
    }
  }

  function formatReviewStory(
    activity
  ) {
    const actor =
      actorPrefix(activity);

    const object =
      getObject(activity);

    switch (activity.action) {
      case "submitted":
      case "review_submitted":
        return (
          `${actor || "An umpire "}` +
          `submitted a game review` +
          (
            object
              ? ` for ${object}`
              : ""
          ) +
          "."
        );

      case "returned":
      case "review_returned":
        return object
          ? `The review for ${object} was returned.`
          : "A game review was returned.";

      case "approved":
      case "review_approved":
        return object
          ? `The review for ${object} was approved.`
          : "A game review was approved.";

      default:
        return (
          activity.message ||
          "Review activity recorded."
        );
    }
  }

  function formatAvailabilityStory(
    activity
  ) {
    const actor =
      getActor(activity);

    return actor
      ? `${actor} updated availability.`
      : (
          activity.message ||
          "Availability was updated."
        );
  }

  function formatStory(activity) {
    if (!activity) {
      return "Activity recorded.";
    }

    switch (activity.type) {
      case "assignment":
      case "claim":
        return formatAssignmentStory(
          activity
        );

      case "account":
        return formatAccountStory(
          activity
        );

      case "game":
      case "schedule":
      case "import":
        return formatGameStory(
          activity
        );

      case "review":
        return formatReviewStory(
          activity
        );

      case "availability":
        return formatAvailabilityStory(
          activity
        );

      default:
        return (
          activity.message ||
          (
            getObject(activity)
              ? `${getObject(activity)} was updated.`
              : "Activity recorded."
          )
        );
    }
  }

  function formatCategory(activity) {
    const labels = {
      account: "Account",
      assignment: "Assignment",
      availability: "Availability",
      claim: "Claim",
      game: "Game",
      import: "Schedule",
      review: "Review",
      schedule: "Schedule"
    };

    return (
      labels[activity?.type] ||
      "Activity"
    );
  }

  function toTimelineItem(activity) {
    return {
      id:
        activity.id || "",

      type:
        activity.type || "general",

      category:
        formatCategory(activity),

      story:
        formatStory(activity),

      createdAt:
        activity.createdAt || "",

      gameId:
        activity.gameId || "",

      accountId:
        activity.accountId || "",

      crewId:
        activity.crewId || "",

      matchup:
        activity.matchup ||
        activity.object ||
        ""
    };
  }

  function getSince(
    since,
    limit = 20
  ) {
    if (
      typeof activityService ===
        "undefined"
    ) {
      return [];
    }

    const activities =
      typeof activityService.getSince ===
        "function"
        ? activityService.getSince(
            since,
            limit
          )
        : activityService.getRecent(
            limit
          );

    return activities.map(
      toTimelineItem
    );
  }

  return {
    formatStory,
    toTimelineItem,
    getSince
  };
})();
