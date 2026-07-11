import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Claim Action Authorization", () => {
  test("administrator may approve a claim", async ({ app }) => {
    await app.createPendingClaim();

    const result = await app.page.evaluate(() => {
      authService.loginAsAdmin();

      const claim = claimsQueueService.getPendingClaims()[0];

      return claimsQueueService.approveClaim(
        claim.gameId,
        claim.assignmentId
      );
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe("Claim approved.");
  });

  test("administrator may reject a claim", async ({ app }) => {
    await app.createPendingClaim();

    const result = await app.page.evaluate(() => {
      authService.loginAsAdmin();

      const claim = claimsQueueService.getPendingClaims()[0];

      return claimsQueueService.rejectClaim(
        claim.gameId,
        claim.assignmentId
      );
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe("Claim rejected.");
  });

  test("assigner may approve a claim", async ({ app }) => {
    await app.createPendingClaim();

    const result = await app.page.evaluate(() => {
      authService.loginAsAssigner();

      const claim = claimsQueueService.getPendingClaims()[0];

      return claimsQueueService.approveClaim(
        claim.gameId,
        claim.assignmentId
      );
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe("Claim approved.");
  });

  test("assigner may reject a claim", async ({ app }) => {
    await app.createPendingClaim();

    const result = await app.page.evaluate(() => {
      authService.loginAsAssigner();

      const claim = claimsQueueService.getPendingClaims()[0];

      return claimsQueueService.rejectClaim(
        claim.gameId,
        claim.assignmentId
      );
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe("Claim rejected.");
  });

  test("umpire cannot approve a claim", async ({ app }) => {
    await app.createPendingClaim();

    const result = await app.page.evaluate(() => {
      authService.loginAsUmpire();

      const claim = claimsQueueService.getPendingClaims()[0];

      return claimsQueueService.approveClaim(
        claim.gameId,
        claim.assignmentId
      );
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe("Unauthorized.");
  });

  test("umpire cannot reject a claim", async ({ app }) => {
    await app.createPendingClaim();

    const result = await app.page.evaluate(() => {
      authService.loginAsUmpire();

      const claim = claimsQueueService.getPendingClaims()[0];

      return claimsQueueService.rejectClaim(
        claim.gameId,
        claim.assignmentId
      );
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe("Unauthorized.");
  });

  test("unauthorized approval does not modify assignment or history", async ({ app }) => {
    await app.createPendingClaim();

    const result = await app.page.evaluate(() => {
      authService.loginAsUmpire();

      const claim = claimsQueueService.getPendingClaims()[0];

      const beforeAssignment = JSON.stringify(
        gameService.getById(claim.gameId).assignments
      );

      const beforeHistory = JSON.stringify(
        claimsQueueService.getClaimHistory()
      );

      const mutation = claimsQueueService.approveClaim(
        claim.gameId,
        claim.assignmentId
      );

      return {
        mutation,
        beforeAssignment,
        afterAssignment: JSON.stringify(
          gameService.getById(claim.gameId).assignments
        ),
        beforeHistory,
        afterHistory: JSON.stringify(
          claimsQueueService.getClaimHistory()
        ),
        pendingClaims: claimsQueueService.getPendingClaims().length
      };
    });

    expect(result.mutation.success).toBe(false);
    expect(result.mutation.message).toBe("Unauthorized.");
    expect(result.afterAssignment).toBe(result.beforeAssignment);
    expect(result.afterHistory).toBe(result.beforeHistory);
    expect(result.pendingClaims).toBe(1);
  });

  test("unauthorized rejection does not modify assignment or history", async ({ app }) => {
    await app.createPendingClaim();

    const result = await app.page.evaluate(() => {
      authService.loginAsUmpire();

      const claim = claimsQueueService.getPendingClaims()[0];

      const beforeAssignment = JSON.stringify(
        gameService.getById(claim.gameId).assignments
      );

      const beforeHistory = JSON.stringify(
        claimsQueueService.getClaimHistory()
      );

      const mutation = claimsQueueService.rejectClaim(
        claim.gameId,
        claim.assignmentId
      );

      return {
        mutation,
        beforeAssignment,
        afterAssignment: JSON.stringify(
          gameService.getById(claim.gameId).assignments
        ),
        beforeHistory,
        afterHistory: JSON.stringify(
          claimsQueueService.getClaimHistory()
        ),
        pendingClaims: claimsQueueService.getPendingClaims().length
      };
    });

    expect(result.mutation.success).toBe(false);
    expect(result.mutation.message).toBe("Unauthorized.");
    expect(result.afterAssignment).toBe(result.beforeAssignment);
    expect(result.afterHistory).toBe(result.beforeHistory);
    expect(result.pendingClaims).toBe(1);
  });
});
