// src/api/auth.js
import { supabase } from '@/supabase';

// 1. 真實註冊
export const register = async (userData) => {
  const { data, error } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password,
  });

  if (error) throw error;

  if (data.user) {
    // 寫入 profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: data.user.id,
          email: userData.email,
          full_name: userData.fullName,
          occupation: userData.occupation,
          company: userData.company,
          role: 'user'
        }
      ]);
      
    if (profileError) console.error('Profile creation failed:', profileError);
  }

  return {
    user: { ...userData, id: data.user.id },
    token: data.session?.access_token
  };
};

// 2. 真實登入 (這一塊是你目前缺少的！)
export const login = async ({ email, password }) => {
  console.log('正在呼叫 Supabase 真實登入...'); // Debug 用
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message || '帳號或密碼錯誤');

  console.log('Supabase 登入成功，取得 Session:', data.session); // Debug 用

  // 順便抓取使用者詳細資料
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  return {
    user: { 
      id: data.user.id, 
      email: data.user.email,
      name: profile?.full_name || 'User',
      occupation: profile?.occupation,
      company: profile?.company,
      role: profile?.role
    },
    token: data.session.access_token
  };
};

// 3. 登出
export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};