import { useState, useEffect } from 'react';
import {
  Card,
  Title,
  Text,
  Metric,
  Flex,
  Grid,
  Badge,
  ProgressBar,
  Button,
  Select,
  SelectItem,
} from '@tremor/react';
import { useAuth } from '../../contexts/AuthContext';
import { getStatements, getStatementsForUsers, getCompPlans } from '../../services/salesforce';
import { CompStatement, CompPlan } from '../../types';
import { formatCurrency, formatPercent } from '../../services/calculator';
import { StatementCard } from './StatementCard';
import { StatementDetailView } from '../statements/StatementDetailView';

export function RepDashboard() {
  const { currentUser, currentUserId, accessLevel, visibleUserIds, logout, loadingUserInfo } = useAuth();

  const [statements, setStatements] = useState<CompStatement[]>([]);
  const [plans, setPlans] = useState<CompPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedStatement, setSelectedStatement] = useState<CompStatement | null>(null);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (!currentUserId || loadingUserInfo) return;

      setLoading(true);
      setError(null);

      try {
        // Load comp plans
        const plansData = await getCompPlans(true);
        setPlans(plansData);

        // Load statements based on access level
        let statementsData: CompStatement[];
        if (accessLevel === 'rep') {
          statementsData = await getStatements(currentUserId);
        } else {
          statementsData = await getStatementsForUsers(visibleUserIds);
        }
        setStatements(statementsData);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load compensation data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUserId, accessLevel, visibleUserIds, loadingUserInfo]);

  // Calculate summary metrics
  const totalEarnings = statements.reduce(
    (sum, s) => sum + (s.Net_Commission__c || s.Gross_Commission__c || 0),
    0
  );

  const avgAttainment = statements.length > 0
    ? statements.reduce((sum, s) => {
        const quota = s.Quota_Amount__c || 0;
        const achieved = s.Achieved_Amount__c || 0;
        return sum + (quota > 0 ? (achieved / quota) * 100 : 0);
      }, 0) / statements.length
    : 0;

  // Filter statements by period
  const filteredStatements = selectedPeriod === 'all'
    ? statements
    : statements.filter(s => s.Fiscal_Period__c === selectedPeriod);

  // Get unique periods for filter
  const uniquePeriods = [...new Set(statements.map(s => s.Fiscal_Period__c))].filter(Boolean);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Paid':
        return 'green';
      case 'Pending_Review':
        return 'yellow';
      case 'Disputed':
        return 'red';
      default:
        return 'gray';
    }
  };

  if (loading || loadingUserInfo) {
    return (
      <div className="min-h-screen bg-resolve-beige p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-resolve-beige">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <Flex justifyContent="between" alignItems="center">
            <div>
              <Title className="text-xl font-bold text-resolve-black">
                Comp Tracker
              </Title>
              <Text className="text-gray-500">
                Welcome, {currentUser?.Name || 'User'}
              </Text>
            </div>
            <Flex className="gap-4">
              <Badge color="blue" size="lg">
                {accessLevel.toUpperCase()}
              </Badge>
              <Button variant="secondary" onClick={logout}>
                Sign Out
              </Button>
            </Flex>
          </Flex>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {error && (
          <Card className="bg-red-50 border-red-200">
            <Text className="text-red-700">{error}</Text>
          </Card>
        )}

        {/* Summary Cards */}
        <Grid numItemsMd={3} className="gap-4">
          <Card decoration="top" decorationColor="emerald">
            <Flex justifyContent="between" alignItems="center">
              <div>
                <Text>Total Earnings (YTD)</Text>
                <Metric>{formatCurrency(totalEarnings)}</Metric>
              </div>
            </Flex>
          </Card>

          <Card decoration="top" decorationColor="blue">
            <Flex justifyContent="between" alignItems="center">
              <div>
                <Text>Avg Attainment</Text>
                <Metric>{formatPercent(avgAttainment)}</Metric>
              </div>
            </Flex>
            <ProgressBar value={Math.min(avgAttainment, 100)} className="mt-2" />
          </Card>

          <Card decoration="top" decorationColor="amber">
            <Flex justifyContent="between" alignItems="center">
              <div>
                <Text>Statements</Text>
                <Metric>{statements.length}</Metric>
              </div>
            </Flex>
            <Text className="text-sm text-gray-500 mt-2">
              {statements.filter(s => s.Status__c === 'Pending_Review').length} pending review
            </Text>
          </Card>
        </Grid>

        {/* Statements Section */}
        <Card>
          <Flex justifyContent="between" alignItems="center" className="mb-4">
            <Title>Commission Statements</Title>
            <Select
              value={selectedPeriod}
              onValueChange={setSelectedPeriod}
              className="w-48"
            >
              <SelectItem value="all">All Periods</SelectItem>
              {uniquePeriods.map(period => (
                <SelectItem key={period} value={period!}>
                  {period}
                </SelectItem>
              ))}
            </Select>
          </Flex>

          {filteredStatements.length === 0 ? (
            <div className="text-center py-8">
              <Text className="text-gray-500">
                No compensation statements found.
              </Text>
              <Text className="text-gray-400 text-sm mt-2">
                Statements will appear here once they are generated.
              </Text>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStatements.map(statement => (
                <StatementCard
                  key={statement.Id}
                  statement={statement}
                  getStatusColor={getStatusColor}
                  onViewDetails={() => setSelectedStatement(statement)}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Plans Info (if any exist) */}
        {plans.length > 0 && (
          <Card>
            <Title className="mb-4">Active Comp Plans</Title>
            <div className="space-y-2">
              {plans.slice(0, 5).map(plan => (
                <Flex key={plan.Id} justifyContent="between" className="py-2 border-b border-gray-100">
                  <div>
                    <Text className="font-medium">{plan.Name}</Text>
                    <Text className="text-sm text-gray-500">
                      {plan.Role_Type__c} | {plan.Plan_Level__c} | {plan.Payout_Frequency__c}
                    </Text>
                  </div>
                  <Badge color={plan.Is_Active__c ? 'green' : 'gray'}>
                    {plan.Is_Active__c ? 'Active' : 'Inactive'}
                  </Badge>
                </Flex>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Statement Detail Modal */}
      {selectedStatement && (
        <StatementDetailView
          statement={selectedStatement}
          onClose={() => setSelectedStatement(null)}
        />
      )}
    </div>
  );
}
