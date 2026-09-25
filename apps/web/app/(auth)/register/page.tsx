'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@novelist/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/store';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AmbientBackground } from '@/components/vfx/ambient-background';
import { SparkleIcon } from '@/components/vfx/magic-sparkles';
import { fireConfetti } from '@/components/vfx/confetti';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setAuth = useAuthStore(s => s.setAuth);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
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
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-background overflow-hidden">
      {/* Dynamic Aurora Ambient Lighting */}
      <AmbientBackground intensity="medium" />

      <Card className="w-full max-w-md glass-card border border-border/70 shadow-2xl relative z-10 rounded-2xl">
        <CardHeader className="text-center pb-4">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-xl mx-auto mb-3 shadow-lg shadow-primary/30">
            N
          </div>
          <CardTitle className="text-2xl font-serif font-bold tracking-tight">Khởi tạo tài khoản</CardTitle>
          <CardDescription className="text-xs">Bắt đầu hành trình sáng tác tiểu thuyết hoàn toàn miễn phí</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Input
                placeholder="Bút danh hoặc tên của bạn"
                {...register('name')}
                className="bg-card/70 rounded-xl"
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Input
                placeholder="Email"
                type="email"
                {...register('email')}
                className="bg-card/70 rounded-xl"
              />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Input
                placeholder="Mật khẩu (tối thiểu 8 ký tự)"
                type="password"
                {...register('password')}
                className="bg-card/70 rounded-xl"
              />
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
            </div>
            <Button
              type="submit"
              className="w-full h-10 font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-md shadow-primary/25 btn-interactive flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SparkleIcon size={14} color="currentColor" />}
              <span>Tạo tài khoản miễn phí</span>
            </Button>
          </form>
          <div className="mt-6 text-center text-xs text-muted-foreground">
            Đã có tài khoản?{' '}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Đăng nhập ngay
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground/75 text-center mt-4 leading-relaxed">
            Dữ liệu sáng tác của bạn được lưu an toàn trên Cloudflare D1. Không phí ẩn, không quảng cáo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
