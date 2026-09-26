'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@novelist/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/store';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AmbientBackground } from '@/components/vfx/ambient-background';
import { SparkleIcon } from '@/components/vfx/magic-sparkles';
import { useEffect } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const router = useRouter();
  const setAuth = useAuthStore(s => s.setAuth);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 1. If already logged in, redirect directly to projects
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('novelist_current_user');
      if (token && userStr) {
        router.push('/projects');
        return;
      }

      // 2. Pre-fill remembered credentials if user enabled remember password
      const savedRemember = localStorage.getItem('novelist_remember_me');
      const savedEmail = localStorage.getItem('novelist_remember_email');
      const savedPassword = localStorage.getItem('novelist_remember_password');

      if (savedRemember === 'false') {
        setRememberMe(false);
      } else {
        setRememberMe(true);
      }

      if (savedEmail) {
        setValue('email', savedEmail);
      }
      if (savedPassword) {
        setValue('password', savedPassword);
      }
    }
  }, [router, setValue]);

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined') {
        if (rememberMe) {
          localStorage.setItem('novelist_remember_me', 'true');
          localStorage.setItem('novelist_remember_email', data.email);
          localStorage.setItem('novelist_remember_password', data.password);
        } else {
          localStorage.setItem('novelist_remember_me', 'false');
          localStorage.removeItem('novelist_remember_email');
          localStorage.removeItem('novelist_remember_password');
        }
      }

      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      setAuth(res.user, res.token);
      toast.success('Đăng nhập thành công!');
      router.push('/projects');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-background overflow-hidden">
      {/* Dynamic Aurora Ambient Lighting */}
      <AmbientBackground intensity="medium" />

      <Card className="w-full max-w-md glass-card border border-border/70 shadow-2xl relative z-10 rounded-2xl">
        <CardHeader className="text-center pb-4">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-xl mx-auto mb-3 shadow-lg shadow-primary/30">
            N
          </div>
          <CardTitle className="text-2xl font-serif font-bold tracking-tight">Chào mừng trở lại</CardTitle>
          <CardDescription className="text-xs">Đăng nhập vào phòng làm việc của bạn</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Input
                placeholder="Email của bạn"
                type="email"
                {...register('email')}
                className="bg-card/70 rounded-xl"
              />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Input
                placeholder="Mật khẩu"
                type="password"
                {...register('password')}
                className="bg-card/70 rounded-xl"
              />
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between text-xs py-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                />
                <span>Ghi nhớ tài khoản & mật khẩu</span>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full h-10 font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-md shadow-primary/25 btn-interactive flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SparkleIcon size={14} color="currentColor" />}
              <span>Đăng nhập</span>
            </Button>
          </form>
          <div className="mt-6 text-center text-xs text-muted-foreground">
            Chưa có tài khoản?{' '}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              Đăng ký miễn phí
            </Link>
          </div>
          <div className="mt-4 text-center">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              ← Về trang chủ
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
