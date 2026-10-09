'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@novelist/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuthStore } from '@/lib/store';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/studio/auth-shell';
import { SparkleIcon } from '@/components/vfx/magic-sparkles';
import { fireConfetti } from '@/components/vfx/confetti';
import { useEffect } from 'react';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('novelist_current_user');
      if (token && userStr) {
        router.push('/projects');
      }
    }
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('novelist_remember_me', 'true');
        localStorage.setItem('novelist_remember_email', data.email);
        localStorage.setItem('novelist_remember_password', data.password);
      }

      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setAuth(res.user, res.token);
      toast.success('Tạo tài khoản thành công!');
      fireConfetti({ type: 'celebration' });
      router.push('/projects');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <Card className="w-full max-w-md border-0 bg-transparent shadow-none">
        <CardHeader className="text-left pb-6">
          <p className="studio-eyebrow mb-4">Phòng viết của bạn</p>
          <h1 className="text-4xl font-serif font-medium tracking-tight">
            Khởi tạo tài khoản
          </h1>
          <CardDescription className="text-xs">
            Bắt đầu hành trình sáng tác tiểu thuyết hoàn toàn miễn phí
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="name">
                Bút danh
              </label>
              <Input
                id="name"
                autoComplete="nickname"
                placeholder="Bút danh hoặc tên của bạn"
                {...register('name')}
                className="bg-card/70 rounded-xl"
              />
              {errors.name && (
                <p className="text-xs text-destructive mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                autoComplete="email"
                placeholder="Email"
                type="email"
                {...register('email')}
                className="bg-card/70 rounded-xl"
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div>
              <label
                className="mb-2 block text-sm font-medium"
                htmlFor="password"
              >
                Mật khẩu
              </label>
              <Input
                id="password"
                autoComplete="new-password"
                placeholder="Mật khẩu (tối thiểu 8 ký tự)"
                type="password"
                {...register('password')}
                className="bg-card/70 rounded-xl"
              />
              {errors.password && (
                <p className="text-xs text-destructive mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-10 font-semibold rounded-xl bg-primary hover:bg-primary/90  btn-interactive flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <SparkleIcon size={14} color="currentColor" />
              )}
              <span>Tạo tài khoản miễn phí</span>
            </Button>
          </form>
          <div className="mt-6 text-center text-xs text-muted-foreground">
            Đã có tài khoản?{' '}
            <Link
              href="/login"
              className="text-primary font-semibold hover:underline"
            >
              Đăng nhập ngay
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground/75 text-center mt-4 leading-relaxed">
            Bản nháp được lưu trên thiết bị và đồng bộ khi dịch vụ có kết nối.
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
