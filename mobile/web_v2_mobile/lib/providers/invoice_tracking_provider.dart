import 'package:flutter/foundation.dart';
import '../../data/models/invoice_tracking_history.dart';
import '../../data/models/invoice_tracking_ticket.dart';
import '../../data/services/invoice_tracking_service.dart';

class InvoiceTrackingProvider extends ChangeNotifier {
  final InvoiceTrackingService _service;

  List<InvoiceTrackingTicket> _tickets = [];
  InvoiceTrackingPagination? _pagination;
  bool _isLoading = false;
  bool _isRefreshing = false;
  String? _errorMessage;

  // Filters
  String _search = '';
  String? _selectedStatus;
  int _currentPage = 1;

  // Selected Ticket Detail & History
  InvoiceTrackingTicket? _selectedTicket;
  List<InvoiceTrackingHistoryItem> _history = [];
  bool _isLoadingDetail = false;
  bool _isLoadingHistory = false;
  bool _isActionSubmitting = false;

  InvoiceTrackingProvider({InvoiceTrackingService? service})
      : _service = service ?? InvoiceTrackingService();

  List<InvoiceTrackingTicket> get tickets => _tickets;
  InvoiceTrackingPagination? get pagination => _pagination;
  bool get isLoading => _isLoading;
  bool get isRefreshing => _isRefreshing;
  String? get errorMessage => _errorMessage;

  String get search => _search;
  String? get selectedStatus => _selectedStatus;
  int get currentPage => _currentPage;

  InvoiceTrackingTicket? get selectedTicket => _selectedTicket;
  List<InvoiceTrackingHistoryItem> get history => _history;
  bool get isLoadingDetail => _isLoadingDetail;
  bool get isLoadingHistory => _isLoadingHistory;
  bool get isActionSubmitting => _isActionSubmitting;

  void setSearch(String query) {
    if (_search != query) {
      _search = query;
      _currentPage = 1;
      fetchTickets();
    }
  }

  void setStatus(String? status) {
    if (_selectedStatus != status) {
      _selectedStatus = (status != null && status.isNotEmpty) ? status : null;
      _currentPage = 1;
      fetchTickets();
    }
  }

  void setPage(int page) {
    if (_currentPage != page) {
      _currentPage = page;
      fetchTickets();
    }
  }

  Future<void> fetchTickets({bool isRefresh = false}) async {
    if (isRefresh) {
      _isRefreshing = true;
    } else {
      _isLoading = true;
    }
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _service.list(
        search: _search,
        status: _selectedStatus != null ? [_selectedStatus!] : null,
        page: _currentPage,
        limit: 20,
      );

      _tickets = response.items;
      _pagination = response.pagination;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoading = false;
      _isRefreshing = false;
      notifyListeners();
    }
  }

  Future<void> fetchTicketDetail(int id) async {
    _isLoadingDetail = true;
    _isLoadingHistory = true;
    notifyListeners();

    try {
      final ticket = await _service.getById(id);
      _selectedTicket = ticket;
      notifyListeners();

      // Fetch history in parallel
      _history = await _service.getHistory(id);
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoadingDetail = false;
      _isLoadingHistory = false;
      notifyListeners();
    }
  }

  Future<List<CopyableTicket>> fetchCopyableTickets(int id) async {
    try {
      return await _service.fetchCopyableTickets(id);
    } catch (_) {
      return [];
    }
  }

  Future<bool> copyDocuments({
    required int id,
    required int sourceTicketId,
    String? driverNote,
  }) async {
    _isActionSubmitting = true;
    notifyListeners();

    try {
      final updatedTicket = await _service.copyDocuments(
        id: id,
        sourceTicketId: sourceTicketId,
        driverNote: driverNote,
      );

      _selectedTicket = updatedTicket;

      final index = _tickets.indexWhere((t) => t.id == id);
      if (index != -1) {
        _tickets[index] = updatedTicket;
      }

      _history = await _service.getHistory(id);

      _isActionSubmitting = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isActionSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<bool> uploadDocuments({
    required int id,
    required List<DocumentFile> files,
    String? driverNote,
  }) async {
    _isActionSubmitting = true;
    notifyListeners();

    try {
      final updatedTicket = await _service.uploadDocuments(
        id: id,
        files: files,
        driverNote: driverNote,
      );

      _selectedTicket = updatedTicket;

      // Update in list as well
      final index = _tickets.indexWhere((t) => t.id == id);
      if (index != -1) {
        _tickets[index] = updatedTicket;
      }

      // Refresh history
      _history = await _service.getHistory(id);

      _isActionSubmitting = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isActionSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<bool> reviewTicket({
    required int id,
    required String action,
    String? supplementNote,
  }) async {
    _isActionSubmitting = true;
    notifyListeners();

    try {
      final updatedTicket = await _service.review(
        id: id,
        action: action,
        supplementNote: supplementNote,
      );

      _selectedTicket = updatedTicket;

      final index = _tickets.indexWhere((t) => t.id == id);
      if (index != -1) {
        _tickets[index] = updatedTicket;
      }

      _history = await _service.getHistory(id);

      _isActionSubmitting = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isActionSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }

  void clearSelectedTicket() {
    _selectedTicket = null;
    _history = [];
    notifyListeners();
  }
}
