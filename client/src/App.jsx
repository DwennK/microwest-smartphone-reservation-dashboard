import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createRequest,
  deleteRequest,
  fetchOptions,
  fetchRequests,
  getExportUrl,
  importRequestsCsv,
  updateRequest,
  updateRequestStatus
} from "./api";
import { APP_VERSION, STATUS_OPTIONS, STATUS_STYLES, STORAGE_OPTIONS } from "./constants";

const emptyForm = {
  customerName: "",
  phoneNumber: "",
  requestedModel: "",
  storageCapacity: "",
  requestDate: getTodayInputValue(),
  status: "en_attente",
  notes: ""
};

const initialFilters = {
  search: "",
  model: "",
  storage: "",
  status: "",
  pendingOnly: false,
  sort: "newest"
};

function getTodayInputValue() {
  const currentDate = new Date();
  const localDate = new Date(currentDate.getTime() - currentDate.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function toInputDate(value) {
  return value ? value.slice(0, 10) : "";
}

function formatSwissDate(value) {
  const inputDate = toInputDate(value);

  if (!inputDate) {
    return "";
  }

  const [year, month, day] = inputDate.split("-");

  if (!year || !month || !day) {
    return inputDate;
  }

  return `${day}.${month}.${year}`;
}

function getStatusLabel(status) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function createPayload(formValues) {
  return {
    customerName: formValues.customerName,
    phoneNumber: formValues.phoneNumber,
    requestedModel: formValues.requestedModel,
    storageCapacity: formValues.storageCapacity || null,
    requestDate: formValues.requestDate,
    status: formValues.status,
    notes: formValues.notes
  };
}

function App() {
  const [allRequests, setAllRequests] = useState([]);
  const [visibleRequests, setVisibleRequests] = useState([]);
  const [options, setOptions] = useState({
    statuses: STATUS_OPTIONS.map((option) => option.value),
    storageCapacities: STORAGE_OPTIONS
  });
  const [filters, setFilters] = useState(initialFilters);
  const [formValues, setFormValues] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [ignoreImportDuplicates, setIgnoreImportDuplicates] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [operationsError, setOperationsError] = useState("");
  const [isOperationsOpen, setIsOperationsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [openStatusMenuId, setOpenStatusMenuId] = useState(null);
  const firstFieldRef = useRef(null);
  const importInputRef = useRef(null);

  const deferredSearch = useDeferredValue(filters.search);

  const appliedFilters = {
    ...filters,
    search: deferredSearch
  };

  useEffect(() => {
    loadDashboard(appliedFilters);
  }, [
    appliedFilters.model,
    appliedFilters.pendingOnly,
    appliedFilters.search,
    appliedFilters.sort,
    appliedFilters.status,
    appliedFilters.storage
  ]);

  useEffect(() => {
    if (!isFormOpen || editingId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      firstFieldRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [editingId, isFormOpen]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (openStatusMenuId === null) {
      return undefined;
    }

    function handlePointerDown(event) {
      const menuRoot = event.target.closest("[data-status-menu-root]");

      if (menuRoot?.getAttribute("data-status-menu-root") === String(openStatusMenuId)) {
        return;
      }

      setOpenStatusMenuId(null);
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [openStatusMenuId]);

  useEffect(() => {
    function handleKeydown(event) {
      if (event.key !== "Escape") {
        return;
      }

      if (openStatusMenuId !== null) {
        setOpenStatusMenuId(null);
        return;
      }

      if (deleteTarget) {
        setDeleteTarget(null);
        return;
      }

      if (isFormOpen) {
        closeForm();
        return;
      }

      if (isOperationsOpen) {
        closeOperations();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [deleteTarget, isFormOpen, isOperationsOpen, openStatusMenuId]);

  async function loadDashboard(activeFilters) {
    setLoading(true);

    try {
      const [allData, filteredData, nextOptions] = await Promise.all([
        fetchRequests(),
        fetchRequests(activeFilters),
        fetchOptions()
      ]);

      setAllRequests(allData);
      setVisibleRequests(filteredData);
      setOptions(nextOptions);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  const modelOptions = useMemo(() => {
    return [...new Set(allRequests.map((item) => item.requestedModel))].sort((left, right) =>
      left.localeCompare(right)
    );
  }, [allRequests]);

  const totalCount = allRequests.length;
  const pendingCount = allRequests.filter((item) => item.status === "en_attente").length;

  function openCreateForm() {
    setEditingId(null);
    setFormValues({
      ...emptyForm,
      requestDate: getTodayInputValue()
    });
    setErrorMessage("");
    setIsFormOpen(true);
  }

  function closeForm() {
    setFormValues({
      ...emptyForm,
      requestDate: getTodayInputValue()
    });
    setEditingId(null);
    setIsFormOpen(false);
    setErrorMessage("");
  }

  function openOperations() {
    setOperationsError("");
    setIsOperationsOpen(true);
  }

  function closeOperations() {
    setOperationsError("");
    setIsOperationsOpen(false);
  }

  function showToast(message, tone = "success") {
    setToast({ id: Date.now(), message, tone });
  }

  function handleStatusSelect(status) {
    setFormValues((current) => ({ ...current, status }));
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setFormValues((current) => ({ ...current, [name]: value }));
  }

  function handleFilterChange(event) {
    const { name, value, type, checked } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const payload = createPayload(formValues);

      if (editingId) {
        await updateRequest(editingId, payload);
        showToast("Demande mise à jour.");
      } else {
        await createRequest(payload);
        showToast("Demande enregistrée.");
      }

      await loadDashboard(appliedFilters);
      closeForm();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(request) {
    setEditingId(request.id);
    setFormValues({
      customerName: request.customerName,
      phoneNumber: request.phoneNumber,
      requestedModel: request.requestedModel,
      storageCapacity: request.storageCapacity ?? "",
      requestDate: toInputDate(request.requestDate),
      status: request.status,
      notes: request.notes ?? ""
    });
    setErrorMessage("");
    setIsFormOpen(true);
  }

  function handleDelete(request) {
    setDeleteTarget(request);
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteRequest(deleteTarget.id);
      showToast("La réservation a été supprimée.");
      setErrorMessage("");

      if (editingId === deleteTarget.id) {
        closeForm();
      }

      setDeleteTarget(null);
      await loadDashboard(appliedFilters);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleQuickContact(requestId) {
    try {
      const request = allRequests.find((item) => item.id === requestId);
      const nextStatus = request?.status === "contacte" ? "en_attente" : "contacte";

      await updateRequestStatus(requestId, nextStatus);
      showToast(
        nextStatus === "contacte"
          ? "La réservation a été marquée comme contactée."
          : "La réservation est repassée en attente."
      );
      setErrorMessage("");
      await loadDashboard(appliedFilters);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleStatusChange(requestId, nextStatus) {
    try {
      await updateRequestStatus(requestId, nextStatus);
      showToast(`Statut mis à jour : ${getStatusLabel(nextStatus)}.`);
      setErrorMessage("");
      setOpenStatusMenuId(null);
      await loadDashboard(appliedFilters);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function handleExportCsv() {
    window.open(getExportUrl(), "_blank", "noopener,noreferrer");
  }

  function handleImportClick() {
    setOperationsError("");
    importInputRef.current?.click();
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setImporting(true);

    try {
      const csvText = await file.text();
      const result = await importRequestsCsv(csvText, {
        ignoreDuplicates: ignoreImportDuplicates
      });
      const message =
        result.importedCount === 0 && result.skippedCount > 0
          ? `Import termine : aucun ajout, ${result.skippedCount} ligne(s) deja presente(s).`
          : result.importedCount === 0
            ? "Import termine : aucune reservation ajoutee."
            : result.skippedCount > 0
              ? `Import CSV termine : ${result.importedCount} ajoutees, ${result.skippedCount} doublons ignores.`
              : `Import CSV termine : ${result.importedCount} reservation(s).`;
      showToast(message);
      setErrorMessage("");
      setOperationsError("");
      closeOperations();
      await loadDashboard(appliedFilters);
    } catch (error) {
      setOperationsError(error.message);
      showToast(error.message, "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-app text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
        <header className="grid gap-4 rounded-3xl border border-white/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <span className="inline-flex w-fit rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
                Microwest
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  Dashboard réservations smartphones
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Enregistrez rapidement les clients à recontacter dès que les prochains lots
                  arrivent en magasin.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:flex">
              <StatCard label="Total réservations" value={totalCount} />
              <StatCard label="En attente" value={pendingCount} accent="amber" />
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportFile}
              />
              <button
                type="button"
                onClick={openCreateForm}
                className="col-span-2 inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-800 lg:col-span-1"
              >
                <PlusIcon />
                Nouvelle réservation
              </button>
              <button
                type="button"
                onClick={openOperations}
                className="col-span-2 inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 lg:col-span-1"
              >
                <MenuIcon />
                Import / Export
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-6">
          <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Filtres rapides</h2>
                <p className="text-sm text-slate-500">
                  Recherchez un client ou ciblez le stock attendu en quelques clics.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFilters(initialFilters)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
              >
                Réinitialiser
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InputField
                label="Recherche client / téléphone"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Nom, numéro ou note"
                autoComplete="off"
              />

              <SelectField
                label="Modèle"
                name="model"
                value={filters.model}
                onChange={handleFilterChange}
              >
                  <option value="">Tous les modèles</option>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Capacité"
                name="storage"
                value={filters.storage}
                onChange={handleFilterChange}
              >
                  <option value="">Toutes les capacités</option>
                {options.storageCapacities.map((capacity) => (
                  <option key={capacity} value={capacity}>
                    {capacity}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Statut"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                disabled={filters.pendingOnly}
              >
                <option value="">Tous les statuts</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Tri date"
                name="sort"
                value={filters.sort}
                onChange={handleFilterChange}
              >
                <option value="newest">Plus récent</option>
                <option value="oldest">Plus ancien</option>
              </SelectField>
            </div>

            <label className="mt-4 inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                name="pendingOnly"
                checked={filters.pendingOnly}
                onChange={handleFilterChange}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
              />
              Seulement en attente
            </label>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Réservations enregistrées</h2>
                <p className="text-sm text-slate-500">
                  {loading ? "Chargement des réservations..." : `${visibleRequests.length} résultat(s) affichés`}
                </p>
              </div>
            </div>

            <div className="space-y-4 md:hidden">
              {!loading && visibleRequests.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  Aucune réservation ne correspond aux filtres actuels.
                </div>
              ) : null}

              {visibleRequests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{request.customerName}</h3>
                      <a
                        href={`tel:${request.phoneNumber}`}
                        className="mt-1 inline-flex text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-3 transition hover:text-slate-900"
                      >
                        {request.phoneNumber}
                      </a>
                    </div>
                    <StatusBadgeMenu
                      request={request}
                      isOpen={openStatusMenuId === request.id}
                      onToggle={() =>
                        setOpenStatusMenuId((current) => (current === request.id ? null : request.id))
                      }
                      onSelectStatus={handleStatusChange}
                    />
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <InfoItem label="Modèle" value={request.requestedModel} />
                    <InfoItem label="Capacité" value={request.storageCapacity || "-"} />
                    <InfoItem label="Date" value={formatSwissDate(request.requestDate)} />
                    <div className="rounded-2xl bg-slate-50 px-3 py-3">
                      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Contacté
                      </dt>
                      <dd className="mt-2">
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={request.status === "contacte"}
                            onChange={() => handleQuickContact(request.id)}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                            aria-label={`Basculer le statut contacté pour ${request.customerName}`}
                          />
                          Oui
                        </label>
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Notes</p>
                    <p className="mt-2 break-words">{request.notes || "-"}</p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(request)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                    >
                      <EditIcon />
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(request)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                    >
                      <TrashIcon />
                      Supprimer
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden rounded-2xl border border-slate-200 md:block">
              <div className="overflow-x-auto overflow-y-visible rounded-2xl">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <TableHead>Client</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Modèle</TableHead>
                      <TableHead>Capacité</TableHead>
                      <TableHead>
                        <button
                          type="button"
                          onClick={() =>
                            setFilters((current) => ({
                              ...current,
                              sort: current.sort === "newest" ? "oldest" : "newest"
                            }))
                          }
                          className="inline-flex items-center gap-1 rounded-lg px-1 py-1 transition hover:bg-slate-100"
                        >
                          Date
                          <SortIcon direction={filters.sort} />
                        </button>
                      </TableHead>
                      <TableHead>Contacté</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[1%] whitespace-nowrap">Actions</TableHead>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white text-sm">
                      {!loading && visibleRequests.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="px-4 py-10 text-center text-slate-500">
                          Aucune réservation ne correspond aux filtres actuels.
                        </td>
                      </tr>
                    ) : null}

                    {visibleRequests.map((request) => (
                      <tr key={request.id} className="align-top">
                        <TableCell strong>{request.customerName}</TableCell>
                        <TableCell>
                          <a
                            href={`tel:${request.phoneNumber}`}
                            className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-3 transition hover:text-slate-950"
                          >
                            {request.phoneNumber}
                          </a>
                        </TableCell>
                        <TableCell>{request.requestedModel}</TableCell>
                        <TableCell>{request.storageCapacity || "-"}</TableCell>
                        <TableCell>{formatSwissDate(request.requestDate)}</TableCell>
                        <TableCell>
                          <label className="inline-flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={request.status === "contacte"}
                              onChange={() => handleQuickContact(request.id)}
                              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                              aria-label={`Basculer le statut contacté pour ${request.customerName}`}
                            />
                          </label>
                        </TableCell>
                        <TableCell>
                          <StatusBadgeMenu
                            request={request}
                            isOpen={openStatusMenuId === request.id}
                            onToggle={() =>
                              setOpenStatusMenuId((current) => (current === request.id ? null : request.id))
                            }
                            onSelectStatus={handleStatusChange}
                          />
                        </TableCell>
                        <TableCell className="max-w-48 break-words text-slate-600">
                          {request.notes || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex flex-nowrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(request)}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                            >
                              <EditIcon />
                              Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(request)}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                            >
                              <TrashIcon />
                              Supprimer
                            </button>
                          </div>
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </section>
        <div className="flex justify-end px-1">
          <span className="rounded-full border border-slate-200/80 bg-white/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            v{APP_VERSION}
          </span>
        </div>
      </div>

      <FormDrawer
        editingId={editingId}
        errorMessage={errorMessage}
        firstFieldRef={firstFieldRef}
        formValues={formValues}
        isOpen={isFormOpen}
        onCancel={closeForm}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        onStatusSelect={handleStatusSelect}
        options={options}
        submitting={submitting}
      />
      <OperationsDrawer
        errorMessage={operationsError}
        ignoreDuplicates={ignoreImportDuplicates}
        importing={importing}
        isOpen={isOperationsOpen}
        onClose={closeOperations}
        onExport={handleExportCsv}
        onImport={handleImportClick}
        onToggleIgnoreDuplicates={() =>
          setIgnoreImportDuplicates((current) => !current)
        }
      />
      {deleteTarget ? (
        <DeleteDialog
          deleteTarget={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
      <ToastStack toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function FormDrawer({
  editingId,
  errorMessage,
  firstFieldRef,
  formValues,
  isOpen,
  onCancel,
  onChange,
  onSubmit,
  onStatusSelect,
  options,
  submitting
}) {
  function handleDrawerKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onCancel();
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 transition ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
      onKeyDown={handleDrawerKeyDown}
    >
      <div
        className={`absolute inset-0 bg-slate-950/30 backdrop-blur-sm transition duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onCancel}
      />
      <div
        className={`absolute inset-y-0 right-0 flex w-full transform flex-col bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] transition duration-300 ease-out ${
          isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
        } md:w-[620px]`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5 md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {editingId ? "Édition" : "Nouvelle réservation"}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">
              {editingId ? "Modifier une réservation" : "Ajouter une réservation"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Formulaire rapide ouvert sans quitter le tableau de bord.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-lg font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
          >
            ×
          </button>
        </div>

        <form
          className="flex h-full flex-1 flex-col overflow-hidden"
          onSubmit={onSubmit}
          autoComplete="off"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 md:px-6">
            <div className="grid gap-4">
              <InputField
                inputRef={firstFieldRef}
                label="Nom du client"
                name="customerName"
                value={formValues.customerName}
                onChange={onChange}
                placeholder="Ex. Sarah Martin"
                required
                autoComplete="off"
              />

              <InputField
                label="Numéro de téléphone"
                name="phoneNumber"
                value={formValues.phoneNumber}
                onChange={onChange}
                placeholder="Ex. 06 12 34 56 78"
                required
                autoComplete="off"
              />

              <InputField
                label="Modèle recherché"
                name="requestedModel"
                value={formValues.requestedModel}
                onChange={onChange}
                placeholder="Ex. iPhone 13"
                required
                autoComplete="off"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Capacité de stockage"
                  name="storageCapacity"
                  value={formValues.storageCapacity}
                  onChange={onChange}
                >
                  <option value="">Aucune préférence</option>
                  {options.storageCapacities.map((capacity) => (
                    <option key={capacity} value={capacity}>
                      {capacity}
                    </option>
                  ))}
                </SelectField>

                <DateField
                  label="Date de la réservation"
                  name="requestDate"
                  value={formValues.requestDate}
                  onChange={onChange}
                  required
                />
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Statut</span>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((status) => {
                    const isActive = formValues.status === status.value;

                    return (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => onStatusSelect(status.value)}
                        className={`inline-flex min-h-11 items-center rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                          isActive
                            ? `${STATUS_STYLES[status.value]} border-transparent`
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950"
                        }`}
                      >
                        {status.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <TextAreaField
                label="Notes"
                name="notes"
                value={formValues.notes}
                onChange={onChange}
                placeholder="Informations utiles pour le rappel client"
                autoComplete="off"
              />

              {errorMessage ? <Feedback tone="error">{errorMessage}</Feedback> : null}
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-10px_30px_rgba(15,23,42,0.06)] sm:px-5 md:px-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                <SaveIcon />
                {submitting ? "Enregistrement..." : editingId ? "Valider" : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
              >
                <CloseIcon />
                Annuler
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function OperationsDrawer({
  errorMessage,
  ignoreDuplicates,
  importing,
  isOpen,
  onClose,
  onExport,
  onImport,
  onToggleIgnoreDuplicates
}) {
  function handleDrawerKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 transition ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
      onKeyDown={handleDrawerKeyDown}
    >
      <div
        className={`absolute inset-0 bg-slate-950/30 backdrop-blur-sm transition duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-y-0 right-0 flex w-full transform flex-col bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] transition duration-300 ease-out ${
          isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
        } md:w-[520px]`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5 md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Fichier
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">
              Import / Export CSV
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Centralisez les echanges de donnees sans quitter le tableau de bord.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-lg font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
          >
            Ã—
          </button>
        </div>

        <div className="flex h-full flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 md:px-6">
            <div className="grid gap-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200">
                    <UploadIcon compact />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-slate-950">Importer un CSV</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Reprend un fichier exporte par l'application et restaure les reservations manquantes.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onImport}
                  disabled={importing}
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  <UploadIcon />
                  {importing ? "Import en cours..." : "Choisir un fichier CSV"}
                </button>
                <label className="mt-4 inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={ignoreDuplicates}
                    onChange={onToggleIgnoreDuplicates}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                  Ignorer les doublons deja presents
                </label>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                    <DownloadIcon compact />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-slate-950">Exporter le filtre courant</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Telecharge une sauvegarde CSV complete de toutes les reservations.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onExport}
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <DownloadIcon />
                  Exporter la sauvegarde CSV
                </button>
              </div>

              <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                Le format supporte correspond au CSV exporte par l'application. L'export produit
                une sauvegarde complete, et l'import peut ignorer les doublons deja presents.
              </div>

              {errorMessage ? <Feedback tone="error">{errorMessage}</Feedback> : null}
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-10px_30px_rgba(15,23,42,0.06)] sm:px-5 md:px-6">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              <CloseIcon />
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteDialog({ deleteTarget, onCancel, onConfirm }) {
  if (!deleteTarget) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] transition" aria-hidden={false}>
      <div
        className="absolute inset-0 bg-slate-950/35 transition duration-200 opacity-100"
        onClick={onCancel}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.18)] transition duration-200 translate-y-0 opacity-100"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Confirmation
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">Supprimer cette réservation ?</h3>
          <p className="mt-2 text-sm text-slate-600">
            {deleteTarget
              ? `La réservation de ${deleteTarget.customerName} pour ${deleteTarget.requestedModel} sera supprimée.`
              : ""}
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Confirmer la suppression
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = "slate" }) {
  const tones = {
    amber: "bg-amber-50 text-amber-950 ring-amber-200",
    slate: "bg-slate-50 text-slate-950 ring-slate-200"
  };

  return (
    <div className={`rounded-2xl px-4 py-3 ring-1 ${tones[accent]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function InputField({
  inputRef,
  label,
  name,
  onChange,
  required = false,
  type = "text",
  value,
  ...props
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input
        ref={inputRef}
        className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        {...props}
      />
    </label>
  );
}

function DateField({ label, name, onChange, required = false, value }) {
  const inputRef = useRef(null);

  function openPicker() {
    if (!inputRef.current) {
      return;
    }

    if (typeof inputRef.current.showPicker === "function") {
      inputRef.current.showPicker();
      return;
    }

    inputRef.current.focus();
    inputRef.current.click();
  }

  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={openPicker}
          className="flex min-h-12 w-full items-center rounded-2xl border border-slate-200 bg-white px-4 pr-12 text-left text-base text-slate-950 outline-none transition hover:border-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
        >
          {formatSwissDate(value)}
        </button>
        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500">
          <CalendarIcon />
        </div>
        <input
          ref={inputRef}
          className="pointer-events-none absolute inset-0 opacity-0"
          type="date"
          lang="fr-CH"
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </label>
  );
}

function SelectField({ children, label, name, onChange, value, disabled = false }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <select
        className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}

function TextAreaField({ label, name, onChange, value, ...props }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <textarea
        className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
        name={name}
        value={value}
        onChange={onChange}
        {...props}
      />
    </label>
  );
}

function Feedback({ children, tone }) {
  const styles = {
    error: "border-rose-200 bg-rose-50 text-rose-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800"
  };

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
}

function InfoItem({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-2 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function StatusBadgeMenu({ request, isOpen, onToggle, onSelectStatus }) {
  const buttonRef = useRef(null);
  const [menuDirection, setMenuDirection] = useState("down");
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [canRenderMenu, setCanRenderMenu] = useState(false);

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) {
      setCanRenderMenu(false);
      return;
    }

    const updatePosition = () => {
      if (!buttonRef.current) {
        setCanRenderMenu(false);
        return;
      }

      const rect = buttonRef.current.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        setCanRenderMenu(false);
        return;
      }

      const estimatedMenuHeight = 184;
      const estimatedMenuWidth = 160;
      const gap = 12;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const nextDirection =
        spaceBelow < estimatedMenuHeight + gap && spaceAbove > estimatedMenuHeight ? "up" : "down";

      setMenuDirection(nextDirection);

      const left = Math.min(
        Math.max(12, rect.right - estimatedMenuWidth),
        window.innerWidth - estimatedMenuWidth - 12
      );
      const top =
        nextDirection === "up"
          ? rect.top - estimatedMenuHeight - gap
          : rect.bottom + gap;

      setMenuPosition({
        left,
        top: Math.max(12, top)
      });
      setCanRenderMenu(true);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-flex" data-status-menu-root={request.id}>
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition hover:brightness-[0.98] focus:outline-none focus:ring-4 focus:ring-slate-200 ${
          STATUS_STYLES[request.status]
        }`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title="Changer le statut"
      >
        {getStatusLabel(request.status)}
        <ChevronDownIcon />
      </button>

      {isOpen && canRenderMenu
        ? createPortal(
            <div
              className={`status-popover fixed z-[80] min-w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-[0_18px_50px_rgba(15,23,42,0.12)] ${
                menuDirection === "up" ? "status-popover-up" : "status-popover-down"
              }`}
              style={{ left: `${menuPosition.left}px`, top: `${menuPosition.top}px` }}
              data-status-menu-root={request.id}
            >
              {STATUS_OPTIONS.map((status) => {
                const isActive = status.value === request.status;

                return (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => onSelectStatus(request.id, status.value)}
                    disabled={isActive}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? "cursor-default bg-slate-100 font-semibold text-slate-950"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <span>{status.label}</span>
                    {isActive ? <CheckIcon /> : null}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function ToastStack({ toast, onClose }) {
  if (!toast) {
    return null;
  }

  const tones = {
    error: {
      accent: "bg-rose-500",
      iconWrap: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
      shell:
        "border-white/80 bg-white/96 text-slate-900 shadow-[0_22px_70px_rgba(225,29,72,0.14)]",
      eyebrow: "text-rose-700",
      title: "Action impossible"
    },
    success: {
      accent: "bg-sky-950",
      iconWrap: "bg-sky-50 text-sky-800 ring-1 ring-sky-200",
      shell:
        "border-white/80 bg-white/96 text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.16)]",
      eyebrow: "text-slate-500",
      title: "Mise à jour enregistrée"
    }
  };

  const tone = tones[toast.tone] ?? tones.success;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4 md:justify-end md:px-6">
      <div
        className={`toast-pop pointer-events-auto relative flex w-full max-w-[24rem] items-start gap-3 overflow-hidden rounded-[1.35rem] border px-4 py-4 backdrop-blur ${tone.shell}`}
      >
        <div className={`absolute inset-y-0 left-0 w-1.5 ${tone.accent}`} />
        <div className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone.iconWrap}`}>
          {toast.tone === "error" ? <ErrorToastIcon /> : <SuccessToastIcon />}
        </div>
        <div className="min-w-0 flex-1 pr-1">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${tone.eyebrow}`}>
            {tone.title}
          </p>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-950">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Fermer la notification"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon({ compact = false }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M10 3v9" strokeLinecap="round" />
      <path d="m6.5 9.5 3.5 3.5 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16h12" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon({ compact = false }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M10 16V7" strokeLinecap="round" />
      <path d="M6.5 10.5 10 7l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16h12" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h12M4 10h12M4 14h12" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M4 14.8V16h1.2l8-8-1.2-1.2-8 8ZM14 7.2l1-1a1.4 1.4 0 0 0 0-2l-.2-.2a1.4 1.4 0 0 0-2 0l-1 1L14 7.2Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4.5 6h11" strokeLinecap="round" />
      <path d="M7.5 6V4.8c0-.4.3-.8.8-.8h3.4c.5 0 .8.4.8.8V6" strokeLinecap="round" />
      <path d="M6.5 6l.6 9c0 .5.4 1 .9 1h4c.5 0 .9-.5.9-1l.6-9" strokeLinecap="round" />
      <path d="M8.5 9.2v4.2M11.5 9.2v4.2" strokeLinecap="round" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M5 4h8l2 2v10H5V4Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 4v4h4V4M8 16v-4h4v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m6 6 8 8M14 6l-8 8" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6.5 3.5v2.2M13.5 3.5v2.2M3.75 7.75h12.5" strokeLinecap="round" />
      <path
        d="M5.5 4.75h9c.97 0 1.75.78 1.75 1.75v8c0 .97-.78 1.75-1.75 1.75h-9c-.97 0-1.75-.78-1.75-1.75v-8c0-.97.78-1.75 1.75-1.75Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SortIcon({ direction }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      {direction === "newest" ? (
        <path d="M10 5v10M6.5 8.5 10 5l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M10 15V5m-3.5 6.5L10 15l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m5.5 7.5 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m5 10 3.2 3.2L15 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SuccessToastIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m5 10 3.2 3.2L15 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorToastIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 6.2v4.8M10 14h.01" strokeLinecap="round" />
      <path d="M10 3.5 17 16.5H3L10 3.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TableHead({ children, className = "" }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>;
}

function TableCell({ children, strong = false, className = "" }) {
  return (
    <td className={`px-4 py-4 text-sm text-slate-700 ${className} ${strong ? "font-semibold" : ""}`}>
      {children}
    </td>
  );
}

export default App;
