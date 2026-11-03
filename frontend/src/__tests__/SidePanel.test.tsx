import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SidePanel from '../components/layout/SidePanel';
import type { FileSystemNode } from '../types';

describe('SidePanel Component', () => {
  const mockFileSystem: FileSystemNode[] = [
    {
      name: 'Documents',
      path: 'C:/Users/Documents',
      type: 'folder',
      indexed: true,
      children: [
        {
          name: 'report.pdf',
          path: 'C:/Users/Documents/report.pdf',
          type: 'file',
          indexed: true,
        },
        {
          name: 'Work',
          path: 'C:/Users/Documents/Work',
          type: 'folder',
          indexed: true,
          children: [
            {
              name: 'notes.txt',
              path: 'C:/Users/Documents/Work/notes.txt',
              type: 'file',
              indexed: true,
            },
          ],
        },
      ],
    },
    {
      name: 'Downloads',
      path: 'C:/Users/Downloads',
      type: 'folder',
      indexed: false,
      children: [
        {
          name: 'setup.exe',
          path: 'C:/Users/Downloads/setup.exe',
          type: 'file',
          indexed: false,
        },
      ],
    },
  ];

  describe('File System Tree Mode', () => {
    test('renders panel title', () => {
      render(<SidePanel fileSystem={mockFileSystem} />);
      expect(screen.getByText('File Explorer')).toBeInTheDocument();
    });

    test('renders file tree when fileSystem prop is provided', () => {
      render(<SidePanel fileSystem={mockFileSystem} />);
      
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Downloads')).toBeInTheDocument();
    });

    test('displays folder icons', () => {
      const { container } = render(<SidePanel fileSystem={mockFileSystem} />);
      const treeNodes = container.querySelectorAll('.tree-node-icon');
      expect(treeNodes.length).toBeGreaterThan(0);
    });

    test('shows indexed status indicators', () => {
      const { container } = render(<SidePanel fileSystem={mockFileSystem} />);
      const statusIndicators = container.querySelectorAll('.tree-index-status');
      expect(statusIndicators.length).toBeGreaterThan(0);
    });

    test('expands folder when clicked', async () => {
      const user = userEvent.setup();
      render(<SidePanel fileSystem={mockFileSystem} />);
      
      const documentsNode = screen.getByText('Documents').closest('.tree-node-content') as HTMLElement;
      await user.click(documentsNode);
      
      await waitFor(() => {
        expect(screen.getByText('report.pdf')).toBeInTheDocument();
        expect(screen.getByText('Work')).toBeInTheDocument();
      });
    });

    test('collapses expanded folder when clicked again', async () => {
      const user = userEvent.setup();
      render(<SidePanel fileSystem={mockFileSystem} />);
      
      const documentsNode = screen.getByText('Documents').closest('.tree-node-content') as HTMLElement;
      
      // Expand
      await user.click(documentsNode);
      await waitFor(() => {
        expect(screen.getByText('report.pdf')).toBeInTheDocument();
      });
      
      // Collapse
      await user.click(documentsNode);
      await waitFor(() => {
        expect(screen.queryByText('report.pdf')).not.toBeInTheDocument();
      });
    });

    test('shows nested folder structure', async () => {
      const user = userEvent.setup();
      render(<SidePanel fileSystem={mockFileSystem} />);
      
      // Expand Documents
      const documentsNode = screen.getByText('Documents').closest('.tree-node-content') as HTMLElement;
      await user.click(documentsNode);
      
      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument();
      });
      
      // Expand Work
      const workNode = screen.getByText('Work').closest('.tree-node-content') as HTMLElement;
      await user.click(workNode);
      
      await waitFor(() => {
        expect(screen.getByText('notes.txt')).toBeInTheDocument();
      });
    });
  });

  describe('Selection Functionality', () => {
    test('allows selecting a single file', async () => {
      const user = userEvent.setup();
      render(<SidePanel fileSystem={mockFileSystem} />);
      
      const documentsNode = screen.getByText('Documents').closest('.tree-node-content') as HTMLElement;
      await user.click(documentsNode);
      
      await waitFor(() => {
        const reportNode = screen.getByText('report.pdf').closest('.tree-node-content') as HTMLElement;
        expect(reportNode).toBeInTheDocument();
      });
    });

    test('checkbox appears for each node', () => {
      const { container } = render(<SidePanel fileSystem={mockFileSystem} />);
      const checkboxes = container.querySelectorAll('.tree-checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    test('clicking checkbox selects node', async () => {
      const user = userEvent.setup();
      const { container } = render(<SidePanel fileSystem={mockFileSystem} />);
      
      const firstCheckbox = container.querySelector('.tree-checkbox') as HTMLElement;
      await user.click(firstCheckbox);
      
      const nodeContent = firstCheckbox.closest('.tree-node-content');
      expect(nodeContent).toHaveClass('selected');
    });
  });

  describe('Actions Menu', () => {
    test('displays Actions button', () => {
      render(<SidePanel fileSystem={mockFileSystem} />);
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    test('opens menu when Actions button is clicked', async () => {
      const user = userEvent.setup();
      render(<SidePanel fileSystem={mockFileSystem} />);
      
      const actionsButton = screen.getByText('Actions');
      await user.click(actionsButton);
      
      await waitFor(() => {
        expect(screen.getByText('Select All')).toBeInTheDocument();
        expect(screen.getByText('Deselect All')).toBeInTheDocument();
        expect(screen.getByText('Index Selected')).toBeInTheDocument();
        expect(screen.getByText('Delete Index')).toBeInTheDocument();
        expect(screen.getByText('Confine Search')).toBeInTheDocument();
      });
    });

    test('closes menu when clicking outside', async () => {
      const user = userEvent.setup();
      render(<SidePanel fileSystem={mockFileSystem} />);
      
      const actionsButton = screen.getByText('Actions');
      await user.click(actionsButton);
      
      await waitFor(() => {
        expect(screen.getByText('Select All')).toBeInTheDocument();
      });
      
      // Click outside the menu
      await user.click(document.body);
      
      await waitFor(() => {
        expect(screen.queryByText('Select All')).not.toBeInTheDocument();
      });
    });

    test('Select All button is disabled when no file system', async () => {
      const user = userEvent.setup();
      render(<SidePanel />);
      
      const actionsButton = screen.getByText('Actions');
      await user.click(actionsButton);
      
      await waitFor(() => {
        const selectAllButton = screen.getByText('Select All');
        expect(selectAllButton).toBeDisabled();
      });
    });

    test('Deselect All button is disabled when nothing is selected', async () => {
      const user = userEvent.setup();
      render(<SidePanel fileSystem={mockFileSystem} />);
      
      const actionsButton = screen.getByText('Actions');
      await user.click(actionsButton);
      
      await waitFor(() => {
        const deselectAllButton = screen.getByText('Deselect All');
        expect(deselectAllButton).toBeDisabled();
      });
    });

    test('action buttons are disabled when nothing is selected', async () => {
      const user = userEvent.setup();
      render(<SidePanel fileSystem={mockFileSystem} />);
      
      const actionsButton = screen.getByText('Actions');
      await user.click(actionsButton);
      
      await waitFor(() => {
        expect(screen.getByText('Index Selected')).toBeDisabled();
        expect(screen.getByText('Delete Index')).toBeDisabled();
        expect(screen.getByText('Confine Search')).toBeDisabled();
      });
    });
  });

  describe('Callbacks', () => {
    test('calls onIndexSelected when Index Selected is clicked', async () => {
      const user = userEvent.setup();
      const mockOnIndexSelected = jest.fn();
      const { container } = render(
        <SidePanel 
          fileSystem={mockFileSystem}
          onIndexSelected={mockOnIndexSelected}
        />
      );
      
      // Select a node first
      const firstCheckbox = container.querySelector('.tree-checkbox') as HTMLElement;
      await user.click(firstCheckbox);
      
      // Open menu and click Index Selected
      await user.click(screen.getByText('Actions'));
      await waitFor(() => {
        expect(screen.getByText('Index Selected')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Index Selected'));
      
      expect(mockOnIndexSelected).toHaveBeenCalled();
    });

    test('calls onDeleteIndexing when Delete Index is clicked', async () => {
      const user = userEvent.setup();
      const mockOnDeleteIndexing = jest.fn();
      const { container } = render(
        <SidePanel 
          fileSystem={mockFileSystem}
          onDeleteIndexing={mockOnDeleteIndexing}
        />
      );
      
      // Select a node
      const firstCheckbox = container.querySelector('.tree-checkbox') as HTMLElement;
      await user.click(firstCheckbox);
      
      // Open menu and click Delete Index
      await user.click(screen.getByText('Actions'));
      await waitFor(() => {
        expect(screen.getByText('Delete Index')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Delete Index'));
      
      expect(mockOnDeleteIndexing).toHaveBeenCalled();
    });

    test('calls onConfineSearch when Confine Search is clicked', async () => {
      const user = userEvent.setup();
      const mockOnConfineSearch = jest.fn();
      const { container } = render(
        <SidePanel 
          fileSystem={mockFileSystem}
          onConfineSearch={mockOnConfineSearch}
        />
      );
      
      // Select a node
      const firstCheckbox = container.querySelector('.tree-checkbox') as HTMLElement;
      await user.click(firstCheckbox);
      
      // Open menu and click Confine Search
      await user.click(screen.getByText('Actions'));
      await waitFor(() => {
        expect(screen.getByText('Confine Search')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Confine Search'));
      
      expect(mockOnConfineSearch).toHaveBeenCalled();
    });
  });

  describe('Panel Toggle', () => {
    test('renders toggle button', () => {
      const { container } = render(<SidePanel fileSystem={mockFileSystem} />);
      const toggleButton = container.querySelector('.side-panel-toggle');
      expect(toggleButton).toBeInTheDocument();
    });

    test('toggle button has correct initial state', () => {
      const { container } = render(<SidePanel fileSystem={mockFileSystem} />);
      const toggleButton = container.querySelector('.side-panel-toggle');
      expect(toggleButton).toHaveClass('closed');
    });

    test('clicking toggle button opens panel', async () => {
      const user = userEvent.setup();
      const { container } = render(<SidePanel fileSystem={mockFileSystem} />);
      
      const toggleButton = container.querySelector('.side-panel-toggle') as HTMLElement;
      await user.click(toggleButton);
      
      const panel = container.querySelector('.side-panel');
      expect(panel).toHaveClass('open');
    });

    test('clicking toggle button again closes panel', async () => {
      const user = userEvent.setup();
      const { container } = render(<SidePanel fileSystem={mockFileSystem} />);
      
      const toggleButton = container.querySelector('.side-panel-toggle') as HTMLElement;
      
      // Open
      await user.click(toggleButton);
      let panel = container.querySelector('.side-panel');
      expect(panel).toHaveClass('open');
      
      // Close
      await user.click(toggleButton);
      panel = container.querySelector('.side-panel');
      expect(panel).toHaveClass('closed');
    });
  });

  describe('Resize Functionality', () => {
    test('renders resize handle', () => {
      const { container } = render(<SidePanel fileSystem={mockFileSystem} />);
      const resizeHandle = container.querySelector('.side-panel-resize-handle');
      expect(resizeHandle).toBeInTheDocument();
    });

    test('resize handle has correct title', () => {
      const { container } = render(<SidePanel fileSystem={mockFileSystem} />);
      const resizeHandle = container.querySelector('.side-panel-resize-handle');
      expect(resizeHandle).toHaveAttribute('title', 'Drag to resize');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty file system', () => {
      render(<SidePanel fileSystem={[]} />);
      expect(screen.getByText('File Explorer')).toBeInTheDocument();
      expect(screen.getByText('No files to display')).toBeInTheDocument();
    });

    test('renders empty state when no fileSystem provided', () => {
      render(<SidePanel />);
      expect(screen.getByText('File Explorer')).toBeInTheDocument();
      expect(screen.getByText('No files to display')).toBeInTheDocument();
    });

    test('handles file system without children', () => {
      const noChildrenSystem: FileSystemNode[] = [
        {
          name: 'EmptyFolder',
          path: 'C:/EmptyFolder',
          type: 'folder',
          indexed: false,
        },
      ];
      
      render(<SidePanel fileSystem={noChildrenSystem} />);
      expect(screen.getByText('EmptyFolder')).toBeInTheDocument();
    });

    test('handles deeply nested file structure', async () => {
      const deepStructure: FileSystemNode[] = [
        {
          name: 'Level1',
          path: 'C:/Level1',
          type: 'folder',
          indexed: true,
          children: [
            {
              name: 'Level2',
              path: 'C:/Level1/Level2',
              type: 'folder',
              indexed: true,
              children: [
                {
                  name: 'Level3',
                  path: 'C:/Level1/Level2/Level3',
                  type: 'folder',
                  indexed: true,
                  children: [
                    {
                      name: 'deep.txt',
                      path: 'C:/Level1/Level2/Level3/deep.txt',
                      type: 'file',
                      indexed: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];
      
      const user = userEvent.setup();
      render(<SidePanel fileSystem={deepStructure} />);
      
      // Expand level 1
      await user.click(screen.getByText('Level1').closest('.tree-node-content') as HTMLElement);
      await waitFor(() => expect(screen.getByText('Level2')).toBeInTheDocument());
      
      // Expand level 2
      await user.click(screen.getByText('Level2').closest('.tree-node-content') as HTMLElement);
      await waitFor(() => expect(screen.getByText('Level3')).toBeInTheDocument());
      
      // Expand level 3
      await user.click(screen.getByText('Level3').closest('.tree-node-content') as HTMLElement);
      await waitFor(() => expect(screen.getByText('deep.txt')).toBeInTheDocument());
    });
  });

  describe('Accessibility', () => {
    test('toggle button has aria-label', () => {
      const { container } = render(<SidePanel fileSystem={mockFileSystem} />);
      const toggleButton = container.querySelector('.side-panel-toggle');
      expect(toggleButton).toHaveAttribute('aria-label', 'Toggle directory panel');
    });

    test('actions button has aria-label', () => {
      render(<SidePanel fileSystem={mockFileSystem} />);
      const actionsButton = screen.getByLabelText('Actions menu');
      expect(actionsButton).toBeInTheDocument();
    });
  });
});
