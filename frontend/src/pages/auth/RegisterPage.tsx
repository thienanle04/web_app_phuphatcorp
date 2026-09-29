import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/authApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Calculator, AlertCircle, CheckCircle } from 'lucide-react';

const schema = yup.object({
  full_name: yup
    .string()
    .required('Họ tên là bắt buộc')
    .min(2, 'Họ tên phải có ít nhất 2 ký tự'),
  username: yup
    .string()
    .required('Tên đăng nhập là bắt buộc')
    .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
    .max(50, 'Tên đăng nhập tối đa 50 ký tự')
    .matches(/^[a-zA-Z0-9_]+$/, 'Tên đăng nhập chỉ được chứa chữ, số và dấu gạch dưới'),
  email: yup
    .string()
    .required('Email là bắt buộc')
    .email('Email không hợp lệ'),
  password: yup
    .string()
    .required('Mật khẩu là bắt buộc')
    .min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  confirmPassword: yup
    .string()
    .required('Xác nhận mật khẩu là bắt buộc')
    .oneOf([yup.ref('password')], 'Mật khẩu xác nhận không khớp'),
});

type FormData = yup.InferType<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
      await authApi.register({
        username: data.username,
        full_name: data.full_name,
        email: data.email,
        password: data.password,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
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

  if (success) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            Đăng ký thành công!
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4">
            Đang chuyển hướng đến trang đăng nhập...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-neutral-800 dark:bg-neutral-200 rounded-lg flex items-center justify-center">
            <Calculator className="w-5 h-5 text-white dark:text-neutral-900" />
          </div>
          <span className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Đăng ký</span>
        </div>

        {serverError && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Họ tên"
            type="text"
            id="full_name"
            placeholder="Nguyễn Văn A"
            error={errors.full_name?.message}
            {...register('full_name')}
          />
          <Input
            label="Tên đăng nhập"
            type="text"
            id="username"
            placeholder="vd: nguyen_van_a"
            error={errors.username?.message}
            {...register('username')}
          />
          <Input
            label="Email"
            type="email"
            id="email"
            placeholder="email@example.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Mật khẩu"
            type="password"
            id="password"
            placeholder="Nhập mật khẩu"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Xác nhận mật khẩu"
            type="password"
            id="confirmPassword"
            placeholder="Nhập lại mật khẩu"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Đăng ký
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex flex-col items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <p>
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-neutral-900 dark:text-neutral-100 font-medium hover:underline">
              Đăng nhập
            </Link>
          </p>
          <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
            <Link to="/support" className="text-neutral-700 dark:text-neutral-300 font-medium hover:underline">
              Trung tâm hỗ trợ
            </Link>
            <span>•</span>
            <Link to="/privacy" className="text-neutral-700 dark:text-neutral-300 font-medium hover:underline">
              Chính sách bảo mật
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
