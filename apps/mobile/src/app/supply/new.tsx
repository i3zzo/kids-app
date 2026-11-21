import { router, useLocalSearchParams } from 'expo-router';
import { SupplyForm } from '@/components/SupplyForm';
import { Screen } from '@/components/ui';
import { addSupply, type SupplyCategory } from '@/lib/api';
import { useFamily } from '@/lib/session';

export default function NewSupply() {
  const { familyId } = useFamily();
  const { child, category } = useLocalSearchParams<{ child: string; category?: SupplyCategory }>();
  return (
    <Screen>
      <SupplyForm
        initial={{ category: category ?? 'diapering', name: '', brand: null, size: null, quantity: 1, unit: 'pcs', low_threshold: 1 }}
        onSubmit={async (s) => {
          await addSupply(familyId, child, s);
          router.back();
        }}
      />
    </Screen>
  );
}
