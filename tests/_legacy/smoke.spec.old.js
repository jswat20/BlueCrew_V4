import { test } from '@playwright/test';

import { openBlueCrew } from './helpers/app';
import {
    openDashboard,
    openSchedule,
    openCrew,
    openReports
} from './helpers/navigation';

test('BlueCrew navigation smoke test', async ({ page }) => {

    await openBlueCrew(page);

    await openDashboard(page);

    await openSchedule(page);

    await openCrew(page);

    await openReports(page);

});