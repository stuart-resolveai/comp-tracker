import { Card, Title, Text, Button } from '@tremor/react';
import { initiateLogin } from '../../services/salesforce';

interface LoginPageProps {
  error?: string | null;
}

export function LoginPage({ error }: LoginPageProps) {
  const handleLogin = async () => {
    try {
      await initiateLogin();
    } catch (err) {
      console.error('Login initiation failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-resolve-beige flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <div className="text-center space-y-6">
          <div>
            <Title className="text-2xl font-bold text-resolve-black">
              Comp Tracker
            </Title>
            <Text className="mt-2 text-gray-600">
              Sales Compensation Management
            </Text>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <Text className="text-red-700 text-sm">{error}</Text>
            </div>
          )}

          <div className="space-y-4">
            <Text className="text-gray-500 text-sm">
              Sign in with your Salesforce account to view your compensation statements,
              track your attainment, and manage your earnings.
            </Text>

            <Button
              onClick={handleLogin}
              size="lg"
              className="w-full bg-resolve-lime text-resolve-black hover:bg-opacity-90"
            >
              Sign in with Salesforce
            </Button>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <Text className="text-xs text-gray-400">
              By signing in, you agree to access your Salesforce data
              for compensation tracking purposes.
            </Text>
          </div>
        </div>
      </Card>
    </div>
  );
}
