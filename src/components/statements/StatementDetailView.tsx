import { useState, useEffect } from 'react';
import {
  Card,
  Title,
  Text,
  Metric,
  Flex,
  Badge,
  ProgressBar,
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Button,
} from '@tremor/react';
import { CompStatement, CompLineItem, PlanTier } from '../../types';
import { getLineItems, getPlanTiers } from '../../services/salesforce';
import { formatCurrency, formatPercent } from '../../services/calculator';

interface StatementDetailViewProps {
  statement: CompStatement;
  onClose: () => void;
}

export function StatementDetailView({ statement, onClose }: StatementDetailViewProps) {
  const [lineItems, setLineItems] = useState<CompLineItem[]>([]);
  const [tiers, setTiers] = useState<PlanTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load line items
        const items = await getLineItems(statement.Id);
        setLineItems(items);

        // Load tiers if we have a plan
        if (statement.Comp_Plan__c) {
          const planTiers = await getPlanTiers(statement.Comp_Plan__c);
          setTiers(planTiers);
        }
      } catch (err) {
        console.error('Error loading statement details:', err);
        setError('Failed to load statement details.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [statement.Id, statement.Comp_Plan__c]);

  const quota = statement.Quota_Amount__c || 0;
  const achieved = statement.Achieved_Amount__c || 0;
  const attainment = quota > 0 ? (achieved / quota) * 100 : 0;
  const grossCommission = statement.Gross_Commission__c || 0;
  const adjustments = statement.Adjustments_Amount__c || 0;
  const netCommission = statement.Net_Commission__c || grossCommission + adjustments;

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <Flex justifyContent="between" alignItems="start" className="mb-6">
          <div>
            <Flex alignItems="center" className="gap-2 mb-2">
              <Title>{statement.Fiscal_Period__c}</Title>
              <Badge color={getStatusColor(statement.Status__c)}>
                {statement.Status__c?.replace('_', ' ')}
              </Badge>
            </Flex>
            <Text className="text-gray-500">
              {formatDate(statement.Period_Start__c)} - {formatDate(statement.Period_End__c)}
            </Text>
            {statement.Comp_Plan__r && (
              <Text className="text-gray-500 text-sm mt-1">
                Plan: {statement.Comp_Plan__r.Name}
              </Text>
            )}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </Flex>

        {error && (
          <Card className="bg-red-50 border-red-200 mb-4">
            <Text className="text-red-700">{error}</Text>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card decoration="top" decorationColor="blue">
            <Text>Quota</Text>
            <Metric className="text-lg">{formatCurrency(quota)}</Metric>
          </Card>
          <Card decoration="top" decorationColor="emerald">
            <Text>Achieved</Text>
            <Metric className="text-lg">{formatCurrency(achieved)}</Metric>
          </Card>
          <Card decoration="top" decorationColor="amber">
            <Text>Attainment</Text>
            <Metric className="text-lg">{formatPercent(attainment)}</Metric>
          </Card>
          <Card decoration="top" decorationColor="violet">
            <Text>Net Commission</Text>
            <Metric className="text-lg">{formatCurrency(netCommission)}</Metric>
          </Card>
        </div>

        {/* Attainment Progress */}
        <Card className="mb-6">
          <Title className="text-sm mb-2">Quota Attainment</Title>
          <ProgressBar
            value={Math.min(attainment, 200)}
            color={attainment >= 100 ? 'emerald' : attainment >= 80 ? 'yellow' : 'red'}
          />
          <Flex justifyContent="between" className="mt-2">
            <Text className="text-xs text-gray-400">0%</Text>
            <Text className="text-sm font-medium">{formatPercent(attainment)}</Text>
            <Text className="text-xs text-gray-400">200%</Text>
          </Flex>
        </Card>

        {/* Commission Breakdown */}
        <Card className="mb-6">
          <Title className="text-sm mb-4">Commission Breakdown</Title>
          <div className="space-y-2">
            <Flex justifyContent="between">
              <Text>Gross Commission</Text>
              <Text className="font-medium">{formatCurrency(grossCommission)}</Text>
            </Flex>
            <Flex justifyContent="between">
              <Text>Adjustments</Text>
              <Text className={`font-medium ${adjustments < 0 ? 'text-red-600' : adjustments > 0 ? 'text-green-600' : ''}`}>
                {adjustments >= 0 ? '+' : ''}{formatCurrency(adjustments)}
              </Text>
            </Flex>
            <div className="border-t border-gray-200 pt-2">
              <Flex justifyContent="between">
                <Text className="font-semibold">Net Commission</Text>
                <Text className="font-semibold text-lg">{formatCurrency(netCommission)}</Text>
              </Flex>
            </div>
          </div>
        </Card>

        {/* Tier Breakdown (if tiers exist) */}
        {tiers.length > 0 && (
          <Card className="mb-6">
            <Title className="text-sm mb-4">Commission Tiers</Title>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Tier</TableHeaderCell>
                  <TableHeaderCell>Attainment Range</TableHeaderCell>
                  <TableHeaderCell>Rate</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tiers.map(tier => (
                  <TableRow key={tier.Id}>
                    <TableCell>{tier.Name}</TableCell>
                    <TableCell>
                      {tier.Attainment_Floor__c}% - {tier.Attainment_Ceiling__c ? `${tier.Attainment_Ceiling__c}%` : 'Uncapped'}
                    </TableCell>
                    <TableCell>{tier.Commission_Rate__c}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Line Items / Deal Breakdown */}
        <Card>
          <Title className="text-sm mb-4">Deal Breakdown ({lineItems.length} deals)</Title>
          {lineItems.length === 0 ? (
            <Text className="text-gray-500 text-center py-4">
              No deal records found for this statement.
            </Text>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Opportunity</TableHeaderCell>
                  <TableHeaderCell>Account</TableHeaderCell>
                  <TableHeaderCell>Amount</TableHeaderCell>
                  <TableHeaderCell>Rate</TableHeaderCell>
                  <TableHeaderCell>Commission</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lineItems.map(item => (
                  <TableRow key={item.Id}>
                    <TableCell>
                      <Text className="font-medium">
                        {item.Opportunity__r?.Name || 'Unknown'}
                      </Text>
                      {item.Opportunity__r?.CloseDate && (
                        <Text className="text-xs text-gray-400">
                          Closed {formatDate(item.Opportunity__r.CloseDate)}
                        </Text>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.Opportunity__r?.Account?.Name || '-'}
                    </TableCell>
                    <TableCell>{formatCurrency(item.Credit_Amount__c || 0)}</TableCell>
                    <TableCell>{formatPercent(item.Commission_Rate__c || 0)}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(item.Commission_Amount__c || 0)}
                    </TableCell>
                    <TableCell>
                      {item.Is_Disputed__c ? (
                        <Badge color="red" size="sm">Disputed</Badge>
                      ) : (
                        <Badge color="green" size="sm">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </Card>
    </div>
  );
}
