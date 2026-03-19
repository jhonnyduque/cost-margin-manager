import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { UserPlus, Trash2, Shield, Search, Printer } from 'lucide-react';
import { EntityList } from '../components/entity/EntityList';
import { Button } from '@/components/ui/Button';
import { AppModal } from '../components/ui/AppModal';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { MetricCard } from '@/components/platform/MetricCard';

interface TeamMember {
    id: string; user_id: string; full_name: string | null; email: string;
    role: string; is_active: boolean; joined_at: string; last_sign_in_at: string | null;
    company_id: string; company_name?: string | null;
}

const ROLE_VARIANT: Record<string, 'neutral' | 'warning' | 'danger' | 'info' | 'success'> = {
    admin: 'warning', owner: 'warning', manager: 'info',
    operator: 'neutral', viewer: 'neutral', super_admin: 'warning',
};

const INVITE_ROLE_OPTIONS = [
    { value: 'manager', label: 'Manager (Admin)' },
    { value: 'operator', label: 'Operador (Escritura)' },
    { value: 'viewer', label: 'Lector (Solo Consulta)' },
] as const;

export default function Team() {
    const { user, currentCompany, userRole, isLoading: authLoading } = useAuth();

    const [members, setMembers] = useState<TeamMember[]>([]);
    const [maxUsers, setMaxUsers] = useState(3);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserFullName, setNewUserFullName] = useState('');
    const [newUserRole, setNewUserRole] = useState<'manager' | 'operator' | 'viewer'>('operator');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const isSuperAdmin = user != null && !currentCompany;
    const actorRole = isSuperAdmin ? 'super_admin' : (userRole || null);
    const canCreate = ['super_admin', 'owner', 'admin', 'manager'].includes(actorRole || '');
    const canEdit = ['super_admin', 'owner', 'admin', 'manager'].includes(actorRole || '');
    const canDelete = ['super_admin', 'owner', 'admin'].includes(actorRole || '');
    const currentUsersCount = members.length;
    const isAtLimit = !isSuperAdmin && currentUsersCount >= maxUsers;
    const percentageUsed = Math.min(100, (currentUsersCount / maxUsers) * 100);

    const canManageRole = (targetRole: string, action: 'edit' | 'delete') => {
        if (isSuperAdmin) return true;
        if (actorRole === 'owner') return ['admin', 'manager', 'operator', 'viewer'].includes(targetRole);
        if (actorRole === 'admin') return ['manager', 'operator', 'viewer'].includes(targetRole);
        if (actorRole === 'manager') { if (action === 'delete') return false; return ['operator', 'viewer'].includes(targetRole); }
        return false;
    };

    const inviteRoleOptions = INVITE_ROLE_OPTIONS.filter(o => {
        if (isSuperAdmin || actorRole === 'owner' || actorRole === 'admin') return true;
        if (actorRole === 'manager') return o.value !== 'manager';
        return false;
    });

    const editRoleOptions = editingMember ? inviteRoleOptions.filter(o => canManageRole(editingMember.role, 'edit')) : inviteRoleOptions;

    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return members;
        const q = searchQuery.toLowerCase().trim();
        return members.filter(m => (m.full_name && m.full_name.toLowerCase().includes(q)) || m.email.toLowerCase().includes(q) || (m.company_name && m.company_name.toLowerCase().includes(q)) || m.role.toLowerCase().includes(q));
    }, [members, searchQuery]);

    useEffect(() => { if (!authLoading && user) { fetchMembers(); if (currentCompany) fetchMaxUsers(); } }, [authLoading, user?.id, currentCompany?.id]);
    useEffect(() => { if (inviteRoleOptions.length > 0 && !inviteRoleOptions.some(o => o.value === newUserRole)) setNewUserRole(inviteRoleOptions[0].value); }, [inviteRoleOptions, newUserRole]);
    useEffect(() => { if (editingMember && editRoleOptions.length > 0 && !editRoleOptions.some(o => o.value === editRole)) setEditRole(editRoleOptions[0].value); }, [editingMember, editRoleOptions, editRole]);

    const fetchMaxUsers = async () => {
        if (!currentCompany) return;
        try {
            const { data, error } = await supabase.from('companies').select('seat_limit').eq('id', currentCompany.id).single();
            if (error) throw error;
            if (data?.seat_limit) setMaxUsers(data.seat_limit);
        } catch { setMaxUsers(3); }
    };

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_team_members', isSuperAdmin ? {} : { p_company_id: currentCompany?.id }).order('joined_at', { ascending: true });
            if (error) throw error;
            setMembers(data || []);
        } catch { setMembers([]); } finally { setLoading(false); }
    };

    const handleCreateUser = async () => {
        if (isAtLimit || inviteRoleOptions.length === 0) return;
        try {
            setLoading(true);
            const { error } = await supabase.functions.invoke('beto-manage-team', { body: { action: 'create', email: newUserEmail, full_name: newUserFullName, role: newUserRole, password: newUserPassword, company_id: currentCompany?.id } });
            if (error) throw error;
            setStatusMessage({ type: 'success', text: `Usuario ${newUserEmail} invitado con éxito.` });
            setNewUserEmail(''); setNewUserFullName(''); setNewUserPassword('');
            setNewUserRole(inviteRoleOptions[0].value); setShowCreateModal(false); fetchMembers();
        } catch (error: any) { setStatusMessage({ type: 'error', text: error.message || 'Error al crear el usuario.' }); } finally { setLoading(false); }
    };

    const handleUpdateMember = async () => {
        if (!editingMember) return;
        try {
            setLoading(true);
            const isSelfUpdate = editingMember.user_id === user?.id;
            const { error } = await (isSelfUpdate
                ? supabase.functions.invoke('beto-update-profile', { body: { full_name: editName, password: editPassword || undefined } })
                : supabase.functions.invoke('beto-manage-team', { body: { action: 'update', target_user_id: editingMember.user_id, full_name: canEdit ? editName : undefined, role: canEdit ? editRole : undefined, password: editPassword || undefined, company_id: editingMember.company_id || currentCompany?.id } })
            );
            if (error) throw error;
            setEditingMember(null); setEditPassword(''); fetchMembers();
            setStatusMessage({ type: 'success', text: 'Miembro actualizado correctamente.' });
        } catch (error: any) { setStatusMessage({ type: 'error', text: error.message || 'Error al actualizar' }); } finally { setLoading(false); }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('¿Archivar este miembro del sistema?')) return;
        try {
            setLoading(true);
            const member = members.find(m => m.user_id === userId);
            const { error } = await supabase.functions.invoke('beto-manage-team', { body: { action: 'delete', target_user_id: userId, company_id: member?.company_id || currentCompany?.id } });
            if (error) throw error; fetchMembers();
        } catch (error: any) { console.error(error); } finally { setLoading(false); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', height: '2.75rem', padding: '0 var(--space-16)', background: 'var(--surface-muted)', border: 'var(--border-default)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-body-size)', color: 'var(--text-primary)', outline: 'none' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: 'var(--text-caption-size)', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 'var(--space-6)', padding: '0 var(--space-4)' };

    const teamConfig = {
        name: 'Miembro', pluralName: 'Equipo', rowIdKey: 'user_id',
        fields: [
            {
                key: 'full_name', label: 'Usuario',
                render: (m: TeamMember) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface-primary-soft)', color: 'var(--state-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', border: '1px solid rgba(37,99,235,0.15)', boxShadow: 'var(--shadow-sm)' }}>
                            {m.email?.substring(0, 2)}
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--text-body-size)', fontWeight: 900, color: 'var(--text-primary)' }}>{m.full_name || 'PENDIENTE'}</div>
                            <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{m.email}</div>
                        </div>
                    </div>
                ),
            },
            {
                key: 'role', label: 'Jerarquía',
                render: (m: TeamMember) => <Badge variant={ROLE_VARIANT[m.role] || 'neutral'}>{m.role.toUpperCase()}</Badge>,
            },
            {
                key: 'status', label: 'Estado',
                render: (m: TeamMember) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                        <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: m.is_active ? 'var(--state-success)' : 'var(--text-muted)' }} />
                        <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', fontWeight: 700 }}>{m.is_active ? 'ACTIVO' : 'INACTIVO'}</span>
                    </div>
                ),
            },
        ],
        actions: [
            { id: 'edit', label: 'Editar', icon: <Shield size={18} />, onClick: (m: TeamMember) => { setEditingMember(m); setEditName(m.full_name || ''); setEditRole(m.role); }, isVisible: (m: TeamMember) => canEdit && canManageRole(m.role, 'edit') },
            { id: 'delete', label: 'Eliminar', icon: <Trash2 size={18} />, color: 'text-red-500', onClick: (m: TeamMember) => handleDeleteUser(m.user_id), isVisible: (m: TeamMember) => canDelete && canManageRole(m.role, 'delete') },
        ],
    };

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Control de Equipo"
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Equipo</span></>}
                    metadata={[<span key="1">Gestión de Seats & Jerarquías</span>, <span key="2">{currentUsersCount} usuarios activos</span>]}
                    rightContent={!isSuperAdmin ? (
                        <div style={{ width: '16rem', marginTop: 'calc(-1 * var(--space-8))' }}>
                            <MetricCard title="OCUPACIÓN DE ASIENTOS" value={`${currentUsersCount} / ${maxUsers}`} visualType="gauge" progressValue={percentageUsed} variant={isAtLimit ? 'error' : percentageUsed > 80 ? 'warning' : 'success'} />
                        </div>
                    ) : undefined}
                    actions={<>
                        <Button variant="secondary" size="sm" onClick={() => window.print()} icon={<Printer size={16} />}>IMPRIMIR</Button>
                        {canCreate && <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)} disabled={isAtLimit} isLoading={loading} icon={<UserPlus size={16} />}>INVITAR MIEMBRO</Button>}
                    </>}
                />

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-12)', paddingTop: 'var(--space-24)', borderTop: 'var(--border-default)', marginBottom: 'var(--space-24)' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '28rem' }}>
                        <Search size={16} style={{ position: 'absolute', left: 'var(--space-16)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input type="text" placeholder="Buscar miembro o rol..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            className="input" style={{ paddingLeft: 'var(--space-40)' }} />
                    </div>
                </div>

                {statusMessage && (
                    <Card style={{ background: 'var(--surface-page)', borderColor: 'var(--border-color-default)', marginBottom: 'var(--space-16)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', padding: 'var(--space-16)' }}>
                            <div style={{ padding: 'var(--space-4)', borderRadius: '50%', background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                                {statusMessage.type === 'success' ? '✓' : '!'}
                            </div>
                            <p style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)' }}>{statusMessage.text}</p>
                            <button onClick={() => setStatusMessage(null)} style={{ marginLeft: 'auto', opacity: 0.4, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                        </div>
                    </Card>
                )}

                <Card noPadding style={{ overflow: 'hidden' }}>
                    <EntityList config={teamConfig as any} items={filteredMembers} loading={loading} onSelectionChange={setSelectedIds} />
                </Card>
            </SectionBlock>

            {/* Modal Invitar */}
            <AppModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onSave={handleCreateUser} title="Invitar al Equipo" tier={2} saveLabel="Enviar Invitación" loading={loading}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-16)' }}>
                    <div style={{ gridColumn: '1 / 2' }}><label style={labelStyle}>Nombre Completo</label><input type="text" style={inputStyle} value={newUserFullName} onChange={e => setNewUserFullName(e.target.value)} placeholder="Ej. Alex Smith" /></div>
                    <div style={{ gridColumn: '2 / 3' }}><label style={labelStyle}>Rol Sugerido</label><select style={inputStyle} value={newUserRole} onChange={(e: any) => setNewUserRole(e.target.value)}>{inviteRoleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                    <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Correo Corporativo</label><input type="email" style={inputStyle} value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="alex@empresa.com" /></div>
                    <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Contraseña Temporal</label><input type="password" style={inputStyle} value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} /></div>
                </div>
            </AppModal>

            {/* Modal Editar */}
            {editingMember && (
                <AppModal isOpen={true} onClose={() => setEditingMember(null)} onSave={handleUpdateMember} title="Configurar Perfil" tier={2} saveLabel="Aplicar Cambios" loading={loading}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-16)' }}>
                        <div style={{ gridColumn: '1 / 2' }}><label style={labelStyle}>Nombre</label><input type="text" style={inputStyle} value={editName} onChange={e => setEditName(e.target.value)} /></div>
                        <div style={{ gridColumn: '2 / 3' }}><label style={labelStyle}>Rol de Sistema</label>
                            <select style={inputStyle} value={editRole} onChange={e => setEditRole(e.target.value)} disabled={editingMember.user_id === user?.id || !canManageRole(editingMember.role, 'edit')}>
                                {editRoleOptions.map(o => <option key={o.value} value={o.value}>{o.label.replace(' (Admin)', '')}</option>)}
                            </select>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Nueva Contraseña (Opcional)</label><input type="password" placeholder="••••••••" style={inputStyle} value={editPassword} onChange={e => setEditPassword(e.target.value)} /></div>
                    </div>
                </AppModal>
            )}
        </PageContainer>
    );
}