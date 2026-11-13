-- Loan money arriving in the account was counted as income, inflating income and savings rate.
UPDATE transactions SET kind = 'transfer'
WHERE kind = 'income' AND charged_amount > 0
  AND (description LIKE '%הלוואה%' OR description LIKE '%הלוואת%' OR lower(description) LIKE '%loan%');
