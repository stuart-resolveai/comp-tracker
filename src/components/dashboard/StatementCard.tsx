import { useState } from 'react';
import {
  Card,
  Text,
  Flex,
  Badge,
  ProgressBar,
  Button,
} from '@tremor/react';
import { CompStatement } from '../../types';
import { formatCurrency, formatPercent } from '../../services/calculator';

interface StatementCardProps {
  statement: CompStatement;
  getStatusColor: (status: string) => string;
  onViewDetails?: () => void;
}

export function StatementCard({ statement, getStatusColor, onViewDetails }: StatementCardProps) {
  const [expanded, setExpanded] = useState(false);

  const quota = statement.Quota_Amount__c || 0;
  const achieved = statement.Achieved_Amount__c || 0;
  const attainment = quota > 0 ? (achieved / quota) * 100 : 0;
  const commission = statement.Net_Commission__c || statement.Gross_Commission__c || 0;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <Flex justifyContent="between" alignItems="start">
        <div className="flex-1">
          <Flex alignItems="center" className="gap-2 mb-2">
            <Text className="font-semibold text-lg">
              {statement.Fiscal_Period__c}
            </Text>
            <Badge color={getStatusColor(statement.Status__c)} size="sm">
              {statement.Status__c?.replace('_', ' ')}
            </Badge>
            <Badge color="gray" size="sm">
              {statement.Period_Type__c}
            </Badge>
          </Flex>

          <Text className="text-gray-500 text-sm">
            {formatDate(statement.Period_Start__c)} - {formatDate(statement.Period_End__c)}
          </Text>

          {statement.User__r && (
            <Text className="text-gray-500 text-sm mt-1">
              {statement.User__r.Name}
            </Text>
          )}
        </div>

        <div className="text-right">
          <Text className="text-2xl font-bold text-resolve-black">
            {formatCurrency(commission)}
          </Text>
          <Text className="text-sm text-gray-500">
            Commission
          </Text>
        </div>
      </Flex>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <Flex justifyContent="between" className="mb-2">
          <Text className="text-sm">Quota Attainment</Text>
          <Text className="text-sm font-medium">
            {formatCurrency(achieved)} / {formatCurrency(quota)}
          </Text>
        </Flex>
        <ProgressBar
          value={Math.min(attainment, 150)}
          color={attainment >= 100 ? 'emerald' : attainment >= 80 ? 'yellow' : 'red'}
          className="mt-1"
        />
        <Flex justifyContent="between" className="mt-1">
          <Text className="text-xs text-gray-400">0%</Text>
          <Text className={`text-sm font-medium ${
            attainment >= 100 ? 'text-emerald-600' : attainment >= 80 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {formatPercent(attainment)}
          </Text>
          <Text className="text-xs text-gray-400">150%</Text>
        </Flex>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          <Flex justifyContent="between">
            <Text className="text-sm text-gray-500">Gross Commission</Text>
            <Text className="text-sm">{formatCurrency(statement.Gross_Commission__c || 0)}</Text>
          </Flex>
          <Flex justifyContent="between">
            <Text className="text-sm text-gray-500">Adjustments</Text>
            <Text className="text-sm">{formatCurrency(statement.Adjustments_Amount__c || 0)}</Text>
          </Flex>
          <Flex justifyContent="between">
            <Text className="text-sm text-gray-500">Net Commission</Text>
            <Text className="text-sm font-medium">{formatCurrency(statement.Net_Commission__c || 0)}</Text>
          </Flex>
          {statement.Achieved_Count__c !== undefined && statement.Achieved_Count__c > 0 && (
            <Flex justifyContent="between">
              <Text className="text-sm text-gray-500">Opportunities</Text>
              <Text className="text-sm">{statement.Achieved_Count__c}</Text>
            </Flex>
          )}
          {statement.Approval_Date__c && (
            <Flex justifyContent="between">
              <Text className="text-sm text-gray-500">Approved</Text>
              <Text className="text-sm">{formatDate(statement.Approval_Date__c)}</Text>
            </Flex>
          )}
        </div>
      )}

      <Flex className="mt-4 gap-2">
        <Button
          variant="light"
          size="xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show Less' : 'Show Summary'}
        </Button>
        {onViewDetails && (
          <Button
            variant="secondary"
            size="xs"
            onClick={onViewDetails}
          >
            View Full Details
          </Button>
        )}
      </Flex>
    </Card>
  );
}
