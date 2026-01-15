import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

const COLORS = {
  primary: '#1E3A5F',
  secondary: '#2ECC71',
  accent: '#F39C12',
  background: '#0D1B2A',
  surface: '#1B2838',
  surfaceLight: '#243447',
  text: '#FFFFFF',
  textSecondary: '#8892A0',
  profit: '#2ECC71',
  loss: '#E74C3C',
};

interface SupportTicket {
  id: string;
  user_id: string;
  email: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
}

export default function AdminSupportScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filterStatus, setFilterStatus] = useState<string | null>('open');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [stats, setStats] = useState({
    open: 0,
    inProgress: 0,
    resolved: 0,
    avgResponseTime: 0,
  });

  const loadTickets = useCallback(async () => {
    try {
      // Get ticket stats
      const { count: openCount } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      const { count: inProgressCount } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_progress');

      const { count: resolvedCount } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'resolved');

      setStats({
        open: openCount || 0,
        inProgress: inProgressCount || 0,
        resolved: resolvedCount || 0,
        avgResponseTime: 0, // Would need response tracking
      });

      // Load tickets
      let query = supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }

      const { data: ticketData } = await query;

      // Get user emails
      const ticketsWithEmails = await Promise.all(
        (ticketData || []).map(async (ticket) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', ticket.user_id)
            .single();

          return {
            ...ticket,
            email: profile?.email || 'Unknown',
          };
        })
      );

      setTickets(ticketsWithEmails);
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTickets();
    setRefreshing(false);
  }, [loadTickets]);

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) throw error;

      Alert.alert('Success', `Ticket status updated to ${newStatus}.`);
      loadTickets();
      setSelectedTicket(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to update ticket status.');
    }
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('support_messages').insert({
        ticket_id: selectedTicket.id,
        sender_type: 'admin',
        sender_id: user?.id,
        message: replyText.trim(),
      });

      if (error) throw error;

      // Update ticket status to in_progress if it was open
      if (selectedTicket.status === 'open') {
        await supabase
          .from('support_tickets')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('id', selectedTicket.id);
      }

      Alert.alert('Success', 'Reply sent.');
      setReplyText('');
      loadTickets();
    } catch (error) {
      Alert.alert('Error', 'Failed to send reply.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return COLORS.loss;
      case 'in_progress':
        return COLORS.accent;
      case 'resolved':
        return COLORS.secondary;
      case 'closed':
        return COLORS.textSecondary;
      default:
        return COLORS.textSecondary;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return COLORS.loss;
      case 'high':
        return COLORS.accent;
      case 'medium':
        return COLORS.secondary;
      default:
        return COLORS.textSecondary;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  // Ticket Detail View
  if (selectedTicket) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setSelectedTicket(null)}
        >
          <Text style={styles.backButtonText}>← Back to Tickets</Text>
        </TouchableOpacity>

        <View style={styles.ticketDetail}>
          <View style={styles.ticketHeader}>
            <Text style={styles.ticketSubject}>{selectedTicket.subject}</Text>
            <View style={styles.ticketBadges}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(selectedTicket.status) },
                ]}
              >
                <Text style={styles.badgeText}>{selectedTicket.status}</Text>
              </View>
              <View
                style={[
                  styles.priorityBadge,
                  { borderColor: getPriorityColor(selectedTicket.priority) },
                ]}
              >
                <Text
                  style={[
                    styles.priorityText,
                    { color: getPriorityColor(selectedTicket.priority) },
                  ]}
                >
                  {selectedTicket.priority}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.ticketMeta}>
            <Text style={styles.metaText}>From: {selectedTicket.email}</Text>
            <Text style={styles.metaText}>
              Created: {format(new Date(selectedTicket.created_at), 'MMM d, yyyy h:mm a')}
            </Text>
          </View>

          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{selectedTicket.message}</Text>
          </View>

          <View style={styles.statusActions}>
            <Text style={styles.actionLabel}>Update Status:</Text>
            <View style={styles.statusButtons}>
              {['open', 'in_progress', 'resolved', 'closed'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusButton,
                    selectedTicket.status === status && styles.statusButtonActive,
                  ]}
                  onPress={() => handleUpdateStatus(selectedTicket.id, status)}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      selectedTicket.status === status && styles.statusButtonTextActive,
                    ]}
                  >
                    {status.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.replySection}>
            <Text style={styles.replyLabel}>Send Reply:</Text>
            <TextInput
              style={styles.replyInput}
              multiline
              numberOfLines={4}
              placeholder="Type your reply..."
              placeholderTextColor={COLORS.textSecondary}
              value={replyText}
              onChangeText={setReplyText}
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleReply}
              disabled={!replyText.trim()}
            >
              <Text style={styles.sendButtonText}>Send Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: COLORS.loss }]}>
          <Text style={styles.statValue}>{stats.open}</Text>
          <Text style={styles.statLabel}>Open</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: COLORS.accent }]}>
          <Text style={styles.statValue}>{stats.inProgress}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: COLORS.secondary }]}>
          <Text style={styles.statValue}>{stats.resolved}</Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        {[null, 'open', 'in_progress', 'resolved', 'closed'].map((status) => (
          <TouchableOpacity
            key={status || 'all'}
            style={[
              styles.filterTab,
              filterStatus === status && styles.filterTabActive,
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text
              style={[
                styles.filterTabText,
                filterStatus === status && styles.filterTabTextActive,
              ]}
            >
              {status ? status.replace('_', ' ') : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Ticket List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.secondary}
          />
        }
      >
        {tickets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No tickets found</Text>
          </View>
        ) : (
          tickets.map((ticket) => (
            <TouchableOpacity
              key={ticket.id}
              style={styles.ticketCard}
              onPress={() => setSelectedTicket(ticket)}
            >
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketSubjectList} numberOfLines={1}>
                  {ticket.subject}
                </Text>
                <Text style={styles.ticketEmail}>{ticket.email}</Text>
                <Text style={styles.ticketDate}>
                  {format(new Date(ticket.created_at), 'MMM d, h:mm a')}
                </Text>
              </View>
              <View style={styles.ticketBadgesSmall}>
                <View
                  style={[
                    styles.statusBadgeSmall,
                    { backgroundColor: getStatusColor(ticket.status) },
                  ]}
                >
                  <Text style={styles.badgeTextSmall}>{ticket.status}</Text>
                </View>
                <View
                  style={[
                    styles.priorityBadgeSmall,
                    { borderColor: getPriorityColor(ticket.priority) },
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityTextSmall,
                      { color: getPriorityColor(ticket.priority) },
                    ]}
                  >
                    {ticket.priority}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    alignItems: 'center',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  filterContainer: {
    maxHeight: 50,
    paddingHorizontal: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: COLORS.secondary,
  },
  filterTabText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  filterTabTextActive: {
    color: COLORS.background,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  ticketCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ticketInfo: {
    flex: 1,
  },
  ticketSubjectList: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  ticketEmail: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  ticketDate: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  ticketBadgesSmall: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeTextSmall: {
    color: COLORS.background,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  priorityBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  priorityTextSmall: {
    fontSize: 9,
    textTransform: 'capitalize',
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: COLORS.secondary,
    fontSize: 16,
  },
  ticketDetail: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  ticketHeader: {
    marginBottom: 16,
  },
  ticketSubject: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  ticketBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  ticketMeta: {
    marginBottom: 16,
  },
  metaText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 4,
  },
  messageBox: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  messageText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 22,
  },
  statusActions: {
    marginBottom: 16,
  },
  actionLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
  },
  statusButtonActive: {
    backgroundColor: COLORS.secondary,
  },
  statusButtonText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  statusButtonTextActive: {
    color: COLORS.background,
    fontWeight: '600',
  },
  replySection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
    paddingTop: 16,
  },
  replyLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  replyInput: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  sendButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  sendButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '600',
  },
});
