import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Calculator, AlertCircle } from 'lucide-react';

const schema = yup.object({
  username: yup
    .string()
    .required('Tên đăng nhập là bắt buộc'),
  password: yup
    .string()
    .required('Mật khẩu là bắt buộc'),
});

type FormData = yup.InferType<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    setIsLoading(true);
    try {
      await login(data.username, data.password);
      navigate('/');
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const err = error as { response?: { data?: { message?: string } } };
        setServerError(err.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
      } else {
        setServerError('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-neutral-800 dark:bg-neutral-200 rounded-lg flex items-center justify-center">
            <Calculator className="w-5 h-5 text-white dark:text-neutral-900" />
          </div>
          <span className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Đăng nhập</span>
        </div>

        {serverError && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Tên đăng nhập"
            type="text"
            id="username"
            placeholder="Nhập tên đăng nhập"
            error={errors.username?.message}
            {...register('username')}
          />
          <Input
            label="Mật khẩu"
            type="password"
            id="password"
            placeholder="Nhập mật khẩu"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Đăng nhập
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-neutral-900 dark:text-neutral-100 font-medium hover:underline">
            Đăng ký
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
