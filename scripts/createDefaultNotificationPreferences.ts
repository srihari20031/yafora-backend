import supabaseDB from '../config/connectDB';

async function createDefaultNotificationPreferences() {
  console.log('Creating default notification preferences for existing users...');

  // First, get all users who already have preferences
  const { data: usersWithPrefs, error: prefsError } = await supabaseDB
    .from('notification_preferences')
    .select('user_id');

  if (prefsError) {
    console.error('Error fetching users with preferences:', prefsError);
    return;
  }

  const userIdsWithPrefs = new Set(usersWithPrefs?.map(p => p.user_id) || []);

  // Get all users
  const { data: allUsers, error: usersError } = await supabaseDB
    .from('profiles')
    .select('id');

  if (usersError) {
    console.error('Error fetching users:', usersError);
    return;
  }

  // Filter users without preferences
  const usersWithoutPrefs = allUsers?.filter(user => !userIdsWithPrefs.has(user.id)) || [];

  console.log(`Found ${usersWithoutPrefs.length} users without preferences`);

  // Insert default preferences for each
  for (const user of usersWithoutPrefs) {
    const { error: insertError } = await supabaseDB
      .from('notification_preferences')
      .insert({
        user_id: user.id,
        // defaults will be applied by database
      });

    if (insertError) {
      console.error(`Error creating preferences for user ${user.id}:`, insertError);
    } else {
      console.log(`Created default preferences for user ${user.id}`);
    }
  }

  console.log('Migration complete');
}

// Run the script
createDefaultNotificationPreferences().catch(console.error);