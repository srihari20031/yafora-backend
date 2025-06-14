import supabaseDB from "../../config/connectDB";

export async function signUpUser(email: string, password: string, fullName: string, role: string) {
  const lowercaseRole = role.toLowerCase();
  
  // Validate role
  if (!['buyer', 'seller', 'admin'].includes(lowercaseRole)) {
    throw new Error('Invalid role');
  }

  const { data, error } = await supabaseDB.auth.signUp({
    email,
    password,
  });

  console.log('SignUp Data:', data);
  console.log('SignUp Error:', error);

  if (error) throw new Error(error.message);

  // The trigger will create the basic profile, now update it with additional info
  if (data.user) {
    const { error: profileError } = await supabaseDB
      .from("profiles")
      .update({
        full_name: fullName,
        role: lowercaseRole,
      })
      .eq("id", data.user.id);

    if (profileError) throw new Error(profileError.message);
  }

  return data;
}

export async function signInUser(email: string, password: string) {
  const { data, error } = await supabaseDB.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);
  return data;
}