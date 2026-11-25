import { queryOptions, useQuery } from '@tanstack/react-query';
import { SupabaseDomVentureRepository } from '../../infrastructure/SupabaseDomVentureRepository';

export const domesticVentureRepository = new SupabaseDomVentureRepository();

export const domesticVenturesQuery = (personaPadreId: number) => queryOptions({
  queryKey: ['domestic', 'ventures', personaPadreId] as const,
  queryFn: () => domesticVentureRepository.getVentures(personaPadreId),
  retry: false,
});

export function useDomesticVentures(personaPadreId: number) {
  return useQuery(domesticVenturesQuery(personaPadreId));
}
