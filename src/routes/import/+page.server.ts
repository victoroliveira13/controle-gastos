import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/index';
import { categories, categoryGroups } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getSetting } from '$lib/server/db/settings';

export const load: PageServerLoad = () => {
	const cats = db
		.select({
			id: categories.id,
			code: categories.code,
			name: categories.name,
			isIncome: categoryGroups.isIncome,
			groupName: categoryGroups.name
		})
		.from(categories)
		.innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
		.where(eq(categories.isActive, true))
		.orderBy(categoryGroups.name, categories.name)
		.all();

	return {
		categories: cats,
		pluggyLastSync: getSetting('pluggy_last_sync', '')
	};
};
