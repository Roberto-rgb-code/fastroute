import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { GeocodingService } from '../geocoding/geocoding.service';
import { PrismaService } from '../prisma/prisma.service';
import { StopsService } from './stops.service';

describe('StopsService', () => {
  let service: StopsService;
  let prisma: { stop: { create: jest.Mock; update: jest.Mock; findMany: jest.Mock; delete: jest.Mock }; event: { count: jest.Mock } };
  let geocoding: { forward: jest.Mock };

  beforeEach(async () => {
    prisma = {
      stop: {
        create: jest.fn(async ({ data }) => ({ id: 's1', ...data })),
        update: jest.fn(async ({ data }) => ({ id: 's1', ...data })),
        findMany: jest.fn(async () => []),
        delete: jest.fn(async () => ({ id: 's1' })),
      },
      event: { count: jest.fn(async () => 0) },
    };
    geocoding = {
      forward: jest.fn(async () => ({
        lat: 20.67,
        lng: -103.35,
        displayName: 'Guadalajara',
        provider: 'nominatim',
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StopsService,
        { provide: PrismaService, useValue: prisma },
        { provide: GeocodingService, useValue: geocoding },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = module.get(StopsService);
  });

  it('creates with provided coordinates without geocoding', async () => {
    await service.create('ent1', {
      label: 'Bodega',
      address: 'Av. López Mateos 100, Guadalajara',
      lat: 20.1,
      lng: -103.2,
    } as never);

    expect(geocoding.forward).not.toHaveBeenCalled();
    expect(prisma.stop.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lat: 20.1, lng: -103.2, enterpriseId: 'ent1' }),
      }),
    );
  });

  it('geocodes when lat/lng are missing', async () => {
    await service.create('ent1', {
      label: 'Bodega',
      address: 'Av. López Mateos 100, Guadalajara',
    } as never);

    expect(geocoding.forward).toHaveBeenCalledWith('Av. López Mateos 100, Guadalajara');
    expect(prisma.stop.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lat: 20.67, lng: -103.35 }),
      }),
    );
  });

  it('rejects empty address when coords missing', async () => {
    await expect(
      service.create('ent1', { label: 'X', address: '  ' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('archives instead of deleting when stop has events', async () => {
    prisma.event.count.mockResolvedValueOnce(2);
    await service.remove('ent1', 's1');
    expect(prisma.stop.update).toHaveBeenCalledWith({
      where: { id: 's1', enterpriseId: 'ent1' },
      data: { isArchived: true },
    });
    expect(prisma.stop.delete).not.toHaveBeenCalled();
  });
});

describe('GeocodingService validation', () => {
  it('rejects short queries', async () => {
    const svc = new GeocodingService({ get: () => undefined } as never);
    await expect(svc.forward('ab')).rejects.toBeInstanceOf(NotFoundException);
  });
});
