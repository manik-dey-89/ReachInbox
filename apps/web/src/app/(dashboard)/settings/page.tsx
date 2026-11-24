'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSenders } from '@/hooks/useSenders';
import { senderSchema, type SenderFormValues } from '@/lib/validations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Server } from 'lucide-react';
import api from '@/lib/api';

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { senders, isLoading: sendersLoading, createSenderAsync, isCreating } = useSenders();
  const [addSenderOpen, setAddSenderOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SenderFormValues>({
    resolver: zodResolver(senderSchema),
    defaultValues: {
      name: '',
      email: '',
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPass: '',
    },
  });

  async function onAddSender(data: SenderFormValues) {
    try {
      await createSenderAsync({
        name: data.name,
        email: data.email,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpUser: data.smtpUser,
        smtpPass: data.smtpPass,
      });
      toast.success('Sender account added!');
      reset();
      setAddSenderOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add sender';
      toast.error(msg);
    }
  }

  async function handleLogout() {
    try {
      await api.post('/api/auth/logout');
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  }

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>

      {/* Profile card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {authLoading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-14 w-14 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xl font-bold">
                  {user?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{user?.name ?? '—'}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email ?? '—'}</p>
                <div className="mt-1.5">
                  <Badge variant="info">Connected via Google</Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sender accounts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sender Accounts</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddSenderOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Sender
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {sendersLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : senders.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Server className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No sender accounts yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>SMTP Host</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {senders.map((sender) => (
                  <TableRow key={sender.id}>
                    <TableCell className="font-medium">{sender.name}</TableCell>
                    <TableCell>{sender.email}</TableCell>
                    <TableCell className="text-slate-500 dark:text-slate-400">
                      {sender.smtpHost}:{sender.smtpPort}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Sign out</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">End your current session.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Sender modal */}
      <Modal open={addSenderOpen} onOpenChange={(open) => !open && setAddSenderOpen(false)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Add Sender Account</ModalTitle>
          </ModalHeader>
          <form onSubmit={handleSubmit(onAddSender)} noValidate>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Name"
                  id="senderName"
                  placeholder="Acme Corp"
                  error={errors.name?.message}
                  {...register('name')}
                />
                <Input
                  label="Email"
                  id="senderEmail"
                  type="email"
                  placeholder="hello@acme.com"
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>
              <Input
                label="SMTP Host"
                id="smtpHost"
                placeholder="smtp.gmail.com"
                error={errors.smtpHost?.message}
                {...register('smtpHost')}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="SMTP Port"
                  id="smtpPort"
                  type="number"
                  placeholder="587"
                  error={errors.smtpPort?.message}
                  {...register('smtpPort', { valueAsNumber: true })}
                />
                <Input
                  label="SMTP Username"
                  id="smtpUser"
                  placeholder="user@gmail.com"
                  error={errors.smtpUser?.message}
                  {...register('smtpUser')}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smtpPass">SMTP Password</Label>
                <Input
                  id="smtpPass"
                  type="password"
                  placeholder="••••••••"
                  error={errors.smtpPass?.message}
                  {...register('smtpPass')}
                />
              </div>
            </div>
            <ModalFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAddSenderOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isCreating}>
                Add Sender
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
